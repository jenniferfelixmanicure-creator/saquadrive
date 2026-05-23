import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Alert, Animated, Easing, FlatList, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppMap from "@/components/AppMap";
import SOSButton from "@/components/SOSButton";
import { useAuth } from "@/contexts/AuthContext";
import { useRide, Location2 as Location, RideType } from "@/contexts/RideContext";
import { useSocket } from "@/contexts/SocketContext";
import { useColors } from "@/hooks/useColors";
import RideChat, { ChatMessage } from "@/components/RideChat";
import AIMonitoringPopup from "@/components/AIMonitoringPopup";
import { searchPlaces, getPlaceDetails, getRoute } from "@/lib/google-maps";
import { API_URL } from "@/constants/api";

type RideOption = { type: RideType; label: string; desc: string };
const RIDE_OPTIONS: RideOption[] = [
  { type: "moto", label: "Moto", desc: "Viagem de moto" },
  { type: "basico", label: "Básico", desc: "Carros 2005–2010" },
  { type: "intermediario", label: "Intermediário", desc: "Carros 2011–2019" },
  { type: "vip", label: "VIP", desc: "Carros 2020–2026" },
];

type Phase = "idle" | "typing" | "confirming" | "finding" | "driver_coming" | "in_progress" | "rating";

function AnimatedDots({ anim, color }: { anim: Animated.Value; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", paddingBottom: 3, gap: 3, marginLeft: 2 }}>
      {[0, 1, 2].map((i) => {
        const opacity = anim.interpolate({ inputRange: [i, i + 0.5, i + 1], outputRange: [0.2, 1, 0.2], extrapolate: "clamp" });
        return <Animated.Text key={i} style={{ fontSize: 20, fontFamily: "Inter_700Bold", color, opacity }}>•</Animated.Text>;
      })}
    </View>
  );
}

function calculatePrice(distKm: number, type: RideType): { total: number; isPeakHour: boolean; surgeMultiplier: number } {
  const prices: Record<RideType, number> = { moto: 1.20, basico: 1.70, intermediario: 2.20, vip: 3.90 };
  const perKm = prices[type] ?? 1.70;
  const hour = new Date().getHours();
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const surge = isPeak ? 1.5 : 1.0;
  const raw = Math.round((5.5 + distKm * perKm) * surge * 100) / 100;
  return { total: Math.max(raw, 10), isPeakHour: isPeak, surgeMultiplier: surge };
}

export default function PassengerHomeScreen() {
  const { user, token, apiFetch } = useAuth();
  const {
    rideStatus, currentRide, requestRide, cancelRide, rateDriver,
    resetRide, routeCoordinates, triggerSOS, driverRealtimeLocation, userLocation,
  } = useRide();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { socket } = useSocket();

  const [phase, setPhase] = useState<Phase>("idle");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<{ address: string; lat: number; lng: number; placeId?: string }[]>([]);
  const [destination, setDestination] = useState<Location | null>(null);
  const [selectedRideType, setSelectedRideType] = useState<RideType>("basico");
  const [selectedStars, setSelectedStars] = useState(5);
  const [previewRouteCoords, setPreviewRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  // Promo
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoDiscountType, setPromoDiscountType] = useState<"fixed" | "percent">("fixed");
  const [promoDesc, setPromoDesc] = useState<string | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const [showMonitoringPopup, setShowMonitoringPopup] = useState(false);

  // Suspensão
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionFee, setSuspensionFee] = useState(7.50);
  const [suspensionMessage, setSuspensionMessage] = useState("");

  // Espera
  const [waitFeeWarning, setWaitFeeWarning] = useState<{ feePerMin: number; message: string } | null>(null);
  const [waitFeeCharged, setWaitFeeCharged] = useState<number | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;
  const neonPulseAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const shieldScaleAnim = useRef(new Animated.Value(1)).current;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 20;

  const origin: Location = userLocation ?? { address: "Sua localização", lat: -22.9200, lng: -42.5100 };

  // Sync phase com rideStatus
  useEffect(() => {
    if (rideStatus === "finding") setPhase("finding");
    else if (rideStatus === "driver_coming") setPhase("driver_coming");
    else if (rideStatus === "in_progress") { setPhase("in_progress"); setShowMonitoringPopup(true); }
    else if (rideStatus === "rating") { setPhase("rating"); setChatOpen(false); setChatMessages([]); setUnreadCount(0); }
    else if (rideStatus === "idle" && phase !== "idle" && phase !== "typing" && phase !== "confirming") {
      setPhase("idle"); setChatMessages([]); setUnreadCount(0);
    }
  }, [rideStatus]);

  // Socket: chat + suspensão + espera
  useEffect(() => {
    if (!socket) return;
    const chatHandler = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpen) { setUnreadCount((n) => n + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    };
    socket.on("chat:message", chatHandler);

    socket.on("passenger:account_suspended", (data: { fee: number; message: string }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsSuspended(true);
      setSuspensionFee(data.fee);
      setSuspensionMessage(data.message);
    });

    socket.on("passenger:wait_fee_warning", (data: { feePerMin: number; message: string }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setWaitFeeWarning(data);
      Alert.alert("⏱ Tempo de espera", data.message);
    });

    socket.on("passenger:wait_fee_charged", (data: { waitTimeFee: number; message: string }) => {
      if (data.waitTimeFee > 0) {
        setWaitFeeCharged(data.waitTimeFee);
        setWaitFeeWarning(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Taxa de espera", data.message);
      }
    });

    return () => {
      socket.off("chat:message", chatHandler);
      socket.off("passenger:account_suspended");
      socket.off("passenger:wait_fee_warning");
      socket.off("passenger:wait_fee_charged");
    };
  }, [socket, chatOpen]);

  // Neon security banner animation (idle)
  useEffect(() => {
    if (phase === "idle" && user?.isApproved) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(neonPulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.sine) }),
          Animated.timing(neonPulseAnim, { toValue: 0, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.sine) }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.delay(600),
          Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(400),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(shieldScaleAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(shieldScaleAnim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      neonPulseAnim.stopAnimation(); neonPulseAnim.setValue(0);
      scanAnim.stopAnimation(); scanAnim.setValue(0);
      shieldScaleAnim.stopAnimation(); shieldScaleAnim.setValue(1);
    }
  }, [phase, user?.isApproved]);

  // Radar animation
  useEffect(() => {
    if (phase === "finding") {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])).start();
      const makeRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(Animated.sequence([Animated.delay(delay), Animated.parallel([Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) })]), Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })]));
      makeRing(ring1Anim, 0).start(); makeRing(ring2Anim, 600).start(); makeRing(ring3Anim, 1200).start();
      Animated.loop(Animated.sequence([Animated.timing(dotsAnim, { toValue: 3, duration: 900, useNativeDriver: false }), Animated.timing(dotsAnim, { toValue: 0, duration: 0, useNativeDriver: false })])).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
      ring1Anim.stopAnimation(); ring1Anim.setValue(0);
      ring2Anim.stopAnimation(); ring2Anim.setValue(0);
      ring3Anim.stopAnimation(); ring3Anim.setValue(0);
      dotsAnim.stopAnimation(); dotsAnim.setValue(0);
    }
  }, [phase]);

  // Busca
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchText.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { const preds = await searchPlaces(searchText); setSearchResults(preds.map((p) => ({ address: p.description, lat: p.lat, lng: p.lng, placeId: p.placeId }))); }
      catch { setSearchResults([]); }
    }, 400);
  }, [searchText]);

  // Prévia de rota
  useEffect(() => {
    if (phase !== "confirming" || !destination || !origin) { setPreviewRouteCoords([]); return; }
    if (routeCoordinates.length > 0) return;
    let cancelled = false;
    (async () => {
      const result = await getRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng });
      if (!cancelled) setPreviewRouteCoords(result?.polylineCoords ?? []);
    })();
    return () => { cancelled = true; };
  }, [phase, destination?.lat, destination?.lng, origin?.lat, origin?.lng]);

  async function validatePromo() {
    if (!promoInput.trim()) { setPromoError("Digite um código"); return; }
    setPromoLoading(true); setPromoError("");
    try {
      const res = await apiFetch("/api/rides/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim() }),
      });
      const data = await res.json() as { valid?: boolean; discountType?: string; discountValue?: number; description?: string; message?: string };
      if (!res.ok || !data.valid) { setPromoError(data.message ?? "Código inválido"); return; }
      setPromoCode(data.discountType ? promoInput.trim().toUpperCase() : null);
      setPromoDiscount(data.discountValue ?? 0);
      setPromoDiscountType((data.discountType as "fixed" | "percent") ?? "fixed");
      setPromoDesc(data.description ?? null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { setPromoError("Erro ao validar código"); }
    finally { setPromoLoading(false); }
  }

  function clearPromo() { setPromoCode(null); setPromoDiscount(0); setPromoInput(""); setPromoError(""); setPromoDesc(null); }

  function getDiscountedPrice(base: number): number {
    if (!promoCode || promoDiscount <= 0) return base;
    if (promoDiscountType === "percent") return Math.max(0, base * (1 - promoDiscount / 100));
    return Math.max(0, base - promoDiscount);
  }

  async function handleDestinationSelect(item: { address: string; lat: number; lng: number; placeId?: string }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let lat = item.lat; let lng = item.lng;
    if (item.placeId && (lat === 0 || lng === 0)) { const d = await getPlaceDetails(item.placeId); if (d) { lat = d.lat; lng = d.lng; } }
    setDestination({ address: item.address, lat, lng });
    setSearchText(item.address);
    setPhase("confirming");
  }

  function handleRequestRide() {
    if (!destination) return;
    if (isSuspended) { Alert.alert("Conta suspensa", suspensionMessage || "Sua conta está suspensa. Entre em contato com o suporte."); return; }
    if (!user?.isApproved) { alert("Sua conta ainda não foi aprovada."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const distanceKm = Math.sqrt(Math.pow((destination.lat - origin.lat) * 111, 2) + Math.pow((destination.lng - origin.lng) * 111 * Math.cos(origin.lat * Math.PI / 180), 2));
    requestRide(origin, destination, selectedRideType, Math.max(distanceKm, 1), user?.id ?? "guest", user?.name ?? "Passageiro");
    setWaitFeeCharged(null); setWaitFeeWarning(null);
  }

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelRide(); resetRide(); setPhase("idle"); setDestination(null); setSearchText("");
    clearPromo(); setWaitFeeCharged(null); setWaitFeeWarning(null);
  }

  async function handleRate() {
    await rateDriver(selectedStars);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("idle"); setDestination(null); setSearchText(""); clearPromo();
  }

  const distKm = destination ? Math.max(1, Math.sqrt(Math.pow((destination.lat - origin.lat) * 111, 2) + Math.pow((destination.lng - origin.lng) * 111 * Math.cos(origin.lat * Math.PI / 180), 2))) : 3;
  const priceInfo = destination ? calculatePrice(distKm, selectedRideType) : { total: 0, surgeMultiplier: 1, isPeakHour: false };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {(phase === "driver_coming" || phase === "in_progress") && (
        <SOSButton onPress={() => triggerSOS()} />
      )}
      <AppMap origin={origin} destination={destination} originColor={colors.primary} destColor={colors.accent} mode="passenger"
        routeCoordinates={routeCoordinates.length > 0 ? routeCoordinates : previewRouteCoords} driverRealtimeLocation={driverRealtimeLocation} />

      {currentRide && user && (
        <RideChat visible={chatOpen} onClose={() => setChatOpen(false)} rideId={currentRide.id} myId={user.id} myName={user.name}
          otherName={currentRide.driver?.name ?? "Motorista"} socket={socket} messages={chatMessages} onNewMessage={(msg) => setChatMessages((prev) => [...prev, msg])} />
      )}

      <AIMonitoringPopup visible={showMonitoringPopup} onClose={() => setShowMonitoringPopup(false)} />

      {/* Suspensão modal */}
      <Modal visible={isSuspended} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.suspendedOverlay}>
          <View style={[styles.suspendedCard, { backgroundColor: colors.card }]}>
            <View style={[styles.suspendedIcon, { backgroundColor: "#FF3B3022" }]}>
              <Feather name="alert-triangle" size={36} color="#FF3B30" />
            </View>
            <Text style={[styles.suspendedTitle, { color: colors.foreground }]}>Conta Suspensa</Text>
            <Text style={[styles.suspendedDesc, { color: colors.mutedForeground }]}>
              {suspensionMessage || `Sua conta foi suspensa por cancelamento tardio.\nTaxa pendente: R$ ${suspensionFee.toFixed(2)}.`}
            </Text>
            <Text style={[styles.suspendedContact, { color: colors.mutedForeground }]}>
              Entre em contato com o suporte para regularizar.
            </Text>
            <TouchableOpacity style={[styles.suspendedDismiss, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => setIsSuspended(false)} activeOpacity={0.7}>
              <Text style={[styles.suspendedDismissText, { color: colors.mutedForeground }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          {phase === "idle" || phase === "typing" ? (
            <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Para onde vamos?" placeholderTextColor={colors.mutedForeground}
              value={searchText} onChangeText={(t) => { setSearchText(t); setPhase("typing"); }} onFocus={() => setPhase("typing")} returnKeyType="search" />
          ) : (
            <Text style={[styles.searchInput, { color: colors.foreground }]} numberOfLines={1}>{destination?.address ?? "Para onde vamos?"}</Text>
          )}
          {(phase === "idle" || phase === "typing" || phase === "confirming") && (
            <TouchableOpacity onPress={() => { setPhase("idle"); setSearchText(""); setDestination(null); clearPromo(); }}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Banner de suspensão */}
        {isSuspended && (
          <TouchableOpacity style={styles.suspendedBanner} onPress={() => setIsSuspended(true)} activeOpacity={0.85}>
            <Feather name="alert-triangle" size={14} color="#fff" />
            <Text style={styles.suspendedBannerText}>Conta suspensa — toque para ver detalhes</Text>
          </TouchableOpacity>
        )}

        {/* Sugestões de endereço aparecem abaixo da barra de busca, acima do teclado */}
        {phase === "typing" && (
          <View style={[styles.suggestionsPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.address}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.destRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleDestinationSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.destIcon, { backgroundColor: colors.muted }]}>
                      <Feather name="map-pin" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.destText, { color: colors.foreground }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            ) : searchText.trim().length > 0 ? (
              <View style={styles.suggestionsEmpty}>
                <Feather name="search" size={20} color={colors.mutedForeground} />
                <Text style={[styles.suggestionsEmptyText, { color: colors.mutedForeground }]}>Buscando endereços...</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {phase !== "typing" && (
      <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: botPad + 16 }]}>

        {phase === "idle" && !user?.isApproved && (
          <View style={styles.emptyState}>
            <View style={[styles.approvalBadge, { backgroundColor: "#FFD60A22" }]}><Feather name="clock" size={32} color="#FFD60A" /></View>
            <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>Conta em análise</Text>
            <Text style={[styles.emptyStateDesc, { color: colors.mutedForeground }]}>Seu documento (RG) está sendo verificado.{"\n"}Aguarde aprovação para solicitar corridas.</Text>
            <TouchableOpacity onPress={() => router.push("/(passenger)/upload-documents")} style={[styles.requestBtn, { backgroundColor: colors.primary, paddingHorizontal: 28, marginTop: 8 }]}>
              <Text style={styles.requestBtnText}>Ver meus documentos</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "idle" && user?.isApproved && (() => {
          const neonGlow = neonPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
          const neonRingScale = neonPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
          const neonRingOpacity = neonPulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.45, 0.15] });
          const scanTranslate = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
          return (
            <View style={styles.neonBanner}>
              {/* Logo */}
              <Image
                source={require("@/assets/images/zerorisco_logo_futuristic.png")}
                style={styles.neonLogo}
                resizeMode="contain"
              />

              {/* Shield core with neon ring */}
              <View style={styles.neonShieldWrapper}>
                <Animated.View style={[styles.neonRing, {
                  opacity: neonRingOpacity,
                  transform: [{ scale: neonRingScale }],
                }]} />
                <Animated.View style={[styles.neonShieldOuter, {
                  transform: [{ scale: shieldScaleAnim }],
                  shadowOpacity: neonGlow as unknown as number,
                }]}>
                  <View style={styles.neonShieldInner}>
                    <Feather name="shield" size={28} color="#00FF88" />
                  </View>
                </Animated.View>

                {/* Scan line */}
                <View style={styles.neonScanClip} pointerEvents="none">
                  <Animated.View style={[styles.neonScanLine, { transform: [{ translateY: scanTranslate }] }]} />
                </View>
              </View>

              {/* Status text */}
              <Animated.Text style={[styles.neonMonitoringText, { opacity: neonGlow as unknown as number }]}>
                ● MONITORANDO
              </Animated.Text>
              <Text style={styles.neonSubText}>ZeroRisco IA ativa · Sistema operacional</Text>

              {/* Status chips */}
              <View style={styles.neonChipsRow}>
                {[
                  { icon: "cpu" as const, label: "IA Ativa" },
                  { icon: "map-pin" as const, label: "GPS Seguro" },
                  { icon: "lock" as const, label: "Criptografado" },
                ].map((chip) => (
                  <View key={chip.label} style={styles.neonChip}>
                    <Feather name={chip.icon} size={11} color="#00FF88" />
                    <Text style={styles.neonChipText}>{chip.label}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <Text style={[styles.neonCtaText, { color: colors.mutedForeground }]}>
                Busque seu destino acima para começar
              </Text>
            </View>
          );
        })()}

        {phase === "confirming" && destination && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.routeInfo}>
              <View style={[styles.routeRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.routeText, { color: colors.mutedForeground }]} numberOfLines={1}>{origin.address}</Text>
              </View>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{destination.address}</Text>
              </View>
            </View>

            {priceInfo.isPeakHour && (
              <View style={{ backgroundColor: "#FF6B0015", borderColor: "#FF6B00", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 18 }}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#FF6B00", fontFamily: "Inter_700Bold", fontSize: 13 }}>Tarifa de hora de pico ativa</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>Alta demanda · multiplicador 1.5x</Text>
                </View>
              </View>
            )}

            <Text style={[styles.sheetTitle, { color: colors.foreground, marginTop: 12 }]}>Escolha o tipo</Text>
            {RIDE_OPTIONS.map((opt) => {
              const { total: optPrice, isPeakHour } = calculatePrice(distKm, opt.type);
              const discounted = getDiscountedPrice(optPrice);
              const selected = selectedRideType === opt.type;
              return (
                <TouchableOpacity key={opt.type}
                  style={[styles.rideOption, { backgroundColor: selected ? colors.primary : colors.muted, borderColor: selected ? colors.primary : colors.border }]}
                  onPress={() => { setSelectedRideType(opt.type); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.8}>
                  <View style={styles.rideOptionLeft}>
                    <Feather name="navigation" size={20} color={selected ? "#fff" : colors.foreground} />
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.rideLabel, { color: selected ? "#fff" : colors.foreground }]}>{opt.label}</Text>
                        {isPeakHour && <View style={{ backgroundColor: "#FF6B00", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><Text style={{ fontSize: 9, color: "#fff", fontFamily: "Inter_700Bold" }}>⚡ 1.5x</Text></View>}
                      </View>
                      <Text style={[styles.rideDesc, { color: selected ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>{opt.desc}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {promoCode && discounted < optPrice ? (
                      <>
                        <Text style={[styles.ridePrice, { color: selected ? "rgba(255,255,255,0.5)" : colors.mutedForeground, textDecorationLine: "line-through", fontSize: 12 }]}>R$ {optPrice.toFixed(2)}</Text>
                        <Text style={[styles.ridePrice, { color: selected ? "#fff" : "#34C759" }]}>R$ {discounted.toFixed(2)}</Text>
                      </>
                    ) : (
                      <Text style={[styles.ridePrice, { color: selected ? "#fff" : colors.foreground }]}>R$ {optPrice.toFixed(2)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Promo code */}
            <View style={[styles.promoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              {promoCode ? (
                <View style={styles.promoApplied}>
                  <Feather name="tag" size={16} color="#34C759" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.promoAppliedText, { color: "#34C759" }]}>{promoCode} aplicado!</Text>
                    {promoDesc ? <Text style={[styles.promoAppliedDesc, { color: colors.mutedForeground }]}>{promoDesc}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={clearPromo} style={[styles.promoRemoveBtn, { borderColor: colors.border }]}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={[styles.promoLabel, { color: colors.mutedForeground }]}>Código promocional</Text>
                  <View style={styles.promoInputRow}>
                    <TextInput style={[styles.promoInput, { color: colors.foreground, borderColor: promoError ? "#FF3B30" : colors.border }]}
                      value={promoInput} onChangeText={(t) => { setPromoInput(t); setPromoError(""); }}
                      placeholder="Digite o código" placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="characters" returnKeyType="done" onSubmitEditing={validatePromo} />
                    <TouchableOpacity style={[styles.promoValidateBtn, { backgroundColor: colors.primary, opacity: promoLoading ? 0.7 : 1 }]} onPress={validatePromo} disabled={promoLoading} activeOpacity={0.85}>
                      <Text style={styles.promoValidateText}>{promoLoading ? "..." : "OK"}</Text>
                    </TouchableOpacity>
                  </View>
                  {!!promoError && <Text style={styles.promoError}>{promoError}</Text>}
                </>
              )}
            </View>

            <TouchableOpacity style={[styles.requestBtn, { backgroundColor: colors.primary }]} onPress={handleRequestRide} activeOpacity={0.85}>
              <Text style={styles.requestBtnText}>
                Solicitar — R$ {getDiscountedPrice(priceInfo.total).toFixed(2)}
                {promoCode ? " (com desconto)" : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, marginTop: 10 }]} onPress={handleCancel} activeOpacity={0.8}>
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {phase === "finding" && (() => {
          const ring1Scale = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
          const ring1Opacity = ring1Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 0.5, 0] });
          const ring2Scale = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
          const ring2Opacity = ring2Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 0.5, 0] });
          const ring3Scale = ring3Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
          const ring3Opacity = ring3Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 0.5, 0] });
          return (
            <View style={styles.findingWrapper}>
              <View style={styles.radarContainer}>
                <Animated.View style={[styles.radarRing, { borderColor: colors.primary, opacity: ring1Opacity, transform: [{ scale: ring1Scale }] }]} />
                <Animated.View style={[styles.radarRing, { borderColor: colors.primary, opacity: ring2Opacity, transform: [{ scale: ring2Scale }] }]} />
                <Animated.View style={[styles.radarRing, { borderColor: colors.primary, opacity: ring3Opacity, transform: [{ scale: ring3Scale }] }]} />
                <Animated.View style={[styles.radarCore, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }]}>
                  <Feather name="navigation" size={30} color="#fff" />
                </Animated.View>
              </View>
              <View style={styles.findingTitleRow}>
                <Text style={[styles.findingTitle, { color: colors.foreground }]}>Procurando motorista parceiro</Text>
                <AnimatedDots anim={dotsAnim} color={colors.primary} />
              </View>
              <Text style={[styles.findingDesc, { color: colors.mutedForeground }]}>Conectando você ao melhor parceiro próximo</Text>
              {destination && (
                <View style={[styles.findingDestBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="map-pin" size={14} color={colors.accent} />
                  <Text style={[styles.findingDestText, { color: colors.mutedForeground }]} numberOfLines={1}>{destination.address}</Text>
                </View>
              )}
              <View style={[styles.findingPriceRow, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
                <Feather name="dollar-sign" size={14} color={colors.primary} />
                <Text style={[styles.findingPriceLabel, { color: colors.mutedForeground }]}>Valor da corrida</Text>
                <Text style={[styles.findingPriceValue, { color: colors.primary }]}>R$ {(currentRide?.price ?? priceInfo.total).toFixed(2)}</Text>
              </View>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]} onPress={handleCancel} activeOpacity={0.8}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancelar busca</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {phase === "driver_coming" && currentRide?.driver && (
          <View>
            <View style={[styles.driverBanner, { backgroundColor: colors.success + "22" }]}>
              <Feather name="user-check" size={16} color={colors.success} />
              <Text style={[styles.driverBannerText, { color: colors.success }]}>Motorista a caminho — {currentRide.driver.eta} min</Text>
            </View>
            {waitFeeWarning && (
              <View style={[styles.waitWarning, { backgroundColor: "#FF9F0A22", borderColor: "#FF9F0A" }]}>
                <Feather name="clock" size={14} color="#FF9F0A" />
                <Text style={[styles.waitWarningText, { color: "#FF9F0A" }]}>
                  Espera gratuita encerrada. R$ {waitFeeWarning.feePerMin.toFixed(2)}/min sendo cobrado.
                </Text>
              </View>
            )}
            <View style={styles.driverCard}>
              {currentRide.driver.photo?.startsWith("http") ? (
                <Image source={{ uri: currentRide.driver.photo }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatar, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.driverAvatarText}>{currentRide.driver.photo ?? currentRide.driver.name[0]}</Text>
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: colors.foreground }]}>{currentRide.driver.name}</Text>
                <Text style={[styles.driverMeta, { color: colors.mutedForeground }]}>⭐ {currentRide.driver.rating.toFixed(1)} · {currentRide.driver.car} {currentRide.driver.color}</Text>
                <Text style={[styles.driverMeta, { color: colors.mutedForeground }]}>🔑 {currentRide.driver.plate}</Text>
              </View>
              <TouchableOpacity style={[styles.chatBtn, { backgroundColor: colors.accent + "22" }]} onPress={() => { setChatOpen(true); setUnreadCount(0); }}>
                <Feather name="message-circle" size={22} color={colors.accent} />
                {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: "#FF6B00" }]}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
              </TouchableOpacity>
            </View>
            {currentRide.pin && (
              <View style={[styles.pinBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="shield" size={16} color={colors.primary} />
                <Text style={[styles.pinText, { color: colors.mutedForeground }]}>PIN de segurança: </Text>
                <Text style={[styles.pinCode, { color: colors.primary }]}>{currentRide.pin}</Text>
              </View>
            )}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.sosBtn, { backgroundColor: colors.destructive }]} onPress={() => { triggerSOS(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }} activeOpacity={0.8}>
                <Feather name="alert-triangle" size={16} color="#fff" /><Text style={styles.sosText}>SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelRideBtn, { borderColor: colors.border }]} onPress={handleCancel} activeOpacity={0.8}>
                <Text style={[styles.cancelRideText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {phase === "in_progress" && currentRide?.driver && (
          <View>
            <View style={[styles.driverBanner, { backgroundColor: colors.accent + "22" }]}>
              <Feather name="navigation" size={16} color={colors.accent} />
              <Text style={[styles.driverBannerText, { color: colors.accent }]}>Corrida em andamento</Text>
            </View>
            {waitFeeCharged && waitFeeCharged > 0 && (
              <View style={[styles.waitWarning, { backgroundColor: "#FF6B0015", borderColor: "#FF6B00" }]}>
                <Feather name="clock" size={14} color="#FF6B00" />
                <Text style={[styles.waitWarningText, { color: "#FF6B00" }]}>Taxa de espera R$ {waitFeeCharged.toFixed(2)} adicionada</Text>
              </View>
            )}
            <View style={styles.driverCard}>
              <View style={[styles.driverAvatar, { backgroundColor: colors.secondary }]}><Text style={styles.driverAvatarText}>{currentRide.driver.photo ?? currentRide.driver.name[0]}</Text></View>
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: colors.foreground }]}>{currentRide.driver.name}</Text>
                <Text style={[styles.driverMeta, { color: colors.mutedForeground }]}>{currentRide.destination.address}</Text>
              </View>
              <TouchableOpacity style={[styles.chatBtn, { backgroundColor: colors.accent + "22" }]} onPress={() => { setChatOpen(true); setUnreadCount(0); }}>
                <Feather name="message-circle" size={22} color={colors.accent} />
                {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: "#FF6B00" }]}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.sosBtn, { backgroundColor: colors.destructive, width: "100%" }]} onPress={() => { triggerSOS(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }} activeOpacity={0.8}>
              <Feather name="alert-triangle" size={16} color="#fff" /><Text style={styles.sosText}>Acionar SOS</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "rating" && (
          <View style={styles.centerContent}>
            <View style={[styles.ratingIcon, { backgroundColor: colors.success + "22" }]}><Text style={{ fontSize: 40 }}>⭐</Text></View>
            <Text style={[styles.findingTitle, { color: colors.foreground }]}>Corrida finalizada!</Text>
            <Text style={[styles.findingDesc, { color: colors.mutedForeground }]}>Como foi sua experiência?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => { setSelectedStars(s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <Text style={{ fontSize: 36, opacity: s <= selectedStars ? 1 : 0.3 }}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.requestBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleRate} activeOpacity={0.85}>
              <Text style={styles.requestBtnText}>Enviar avaliação</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, height: 52, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  suspendedBanner: { backgroundColor: "#FF3B30", borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  suspendedBannerText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  bottomSheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 20, maxHeight: "60%" },
  sheetTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  destRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  destIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  destText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  routeInfo: { marginBottom: 4 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  rideOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  rideOptionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rideLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  rideDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ridePrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  promoBox: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  promoLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  promoInputRow: { flexDirection: "row", gap: 8 },
  promoInput: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  promoValidateBtn: { height: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  promoValidateText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  promoError: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#FF3B30" },
  promoApplied: { flexDirection: "row", alignItems: "center", gap: 10 },
  promoAppliedText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  promoAppliedDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  promoRemoveBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  requestBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  requestBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  cancelBtn: { flexDirection: "row", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  centerContent: { alignItems: "center", paddingVertical: 16, gap: 10 },
  findingTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  findingDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  driverBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  driverBannerText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  waitWarning: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10 },
  waitWarningText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  driverCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  driverAvatarText: { fontSize: 20 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  driverMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  chatBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  pinBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12 },
  pinText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  pinCode: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  sosBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 12, gap: 8 },
  sosText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  cancelRideBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 48, borderRadius: 12, borderWidth: 1 },
  cancelRideText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  ratingIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  starsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  suggestionsPanel: { borderRadius: 16, borderWidth: 1, marginTop: 4, maxHeight: 280, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  suggestionsEmpty: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  suggestionsEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 10 },
  emptyStateTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyStateDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  approvalBadge: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  findingWrapper: { alignItems: "center", paddingVertical: 8, gap: 12 },
  radarContainer: { width: 100, height: 100, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  radarRing: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 2 },
  radarCore: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  findingTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  findingDestBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, width: "100%" },
  findingDestText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  findingPriceRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, width: "100%" },
  findingPriceLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  findingPriceValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  suspendedOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  suspendedCard: { width: "100%", borderRadius: 24, padding: 28, gap: 12, alignItems: "center" },
  suspendedIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  suspendedTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  suspendedDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  suspendedContact: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  suspendedDismiss: { height: 46, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 8 },
  suspendedDismissText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  neonBanner: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
    overflow: "hidden",
  },
  neonLogo: {
    width: 140,
    height: 36,
    marginBottom: 4,
  },
  neonShieldWrapper: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  neonRing: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#00FF88",
  },
  neonShieldOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,255,136,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(0,255,136,0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 12,
  },
  neonShieldInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,255,136,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  neonScanClip: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    pointerEvents: "none",
  },
  neonScanLine: {
    width: "100%",
    height: 2,
    backgroundColor: "rgba(0,255,136,0.6)",
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  neonMonitoringText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#00FF88",
    letterSpacing: 3,
    textShadowColor: "#00FF88",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  neonSubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(0,255,136,0.5)",
    letterSpacing: 0.5,
  },
  neonChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  neonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,255,136,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.25)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  neonChipText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(0,255,136,0.8)",
    letterSpacing: 0.3,
  },
  neonCtaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 2,
  },
});
