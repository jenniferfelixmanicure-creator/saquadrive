import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated, Easing, FlatList, Platform, ScrollView,
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
import { searchPlaces, getPlaceDetails, getRoute } from "@/lib/google-maps";


type RideOption = { type: RideType; label: string; desc: string };
const RIDE_OPTIONS: RideOption[] = [
  { type: "moto", label: "Moto", desc: "Viagem de moto" },
  { type: "basico", label: "Básico", desc: "Carros 2005–2010" },
  { type: "intermediario", label: "Intermediário", desc: "Carros 2011–2019" },
  { type: "vip", label: "VIP", desc: "Carros 2020–2026" },
];

type Phase = "idle" | "typing" | "confirming" | "finding" | "driver_coming" | "in_progress" | "rating";


// ─── Reticências animadas ────────────────────────────────────────────────────
function AnimatedDots({ anim, color }: { anim: Animated.Value; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", paddingBottom: 3, gap: 3, marginLeft: 2 }}>
      {[0, 1, 2].map((i) => {
        const opacity = anim.interpolate({
          inputRange: [i, i + 0.5, i + 1],
          outputRange: [0.2, 1, 0.2],
          extrapolate: "clamp",
        });
        return <Animated.Text key={i} style={{ fontSize: 20, fontFamily: "Inter_700Bold", color, opacity }}>•</Animated.Text>;
      })}
    </View>
  );
}

export default function PassengerHomeScreen() {
  const { user } = useAuth();
  const {
    rideStatus, currentRide, requestRide, cancelRide, rateDriver,
    calculatePrice, resetRide, routeCoordinates, triggerSOS,
    driverRealtimeLocation, userLocation,
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

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 20;

  // Localização atual do usuário (real via GPS ou fallback)
  const origin: Location = userLocation ?? {
    address: "Sua localização", lat: -22.9200, lng: -42.5100,
  };

  // Sync phase com rideStatus do backend
  useEffect(() => {
    if (rideStatus === "finding") setPhase("finding");
    else if (rideStatus === "driver_coming") setPhase("driver_coming");
    else if (rideStatus === "in_progress") setPhase("in_progress");
    else if (rideStatus === "rating") {
      setPhase("rating");
      setChatOpen(false);
      setChatMessages([]);
      setUnreadCount(0);
    } else if (
      rideStatus === "idle" &&
      phase !== "idle" && phase !== "typing" && phase !== "confirming"
    ) {
      setPhase("idle");
      setChatMessages([]);
      setUnreadCount(0);
    }
  }, [rideStatus]);

  // Chat
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpen) {
        setUnreadCount((n) => n + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    socket.on("chat:message", handler);
    return () => { socket.off("chat:message", handler); };
  }, [socket, chatOpen]);

  // passenger:error é tratado pelo RideContext — não duplicar aqui

  // Radar + pulse animation
  useEffect(() => {
    if (phase === "finding") {
      // Center pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      // Staggered radar rings
      const makeRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
            ]),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      makeRing(ring1Anim, 0).start();
      makeRing(ring2Anim, 600).start();
      makeRing(ring3Anim, 1200).start();

      // Animated dots
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotsAnim, { toValue: 3, duration: 900, useNativeDriver: false }),
          Animated.timing(dotsAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
      ring1Anim.stopAnimation(); ring1Anim.setValue(0);
      ring2Anim.stopAnimation(); ring2Anim.setValue(0);
      ring3Anim.stopAnimation(); ring3Anim.setValue(0);
      dotsAnim.stopAnimation(); dotsAnim.setValue(0);
    }
  }, [phase]);

  // Busca de lugares em tempo real usando Google Places
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const predictions = await searchPlaces(searchText);
        setSearchResults(predictions.map((p) => ({
          address: p.description,
          lat: p.lat,
          lng: p.lng,
          placeId: p.placeId,
        })));
      } catch {
        setSearchResults([]);
      }
    }, 400);
  }, [searchText]);

  // Gerar rota de prévia quando destino é selecionado (fase "confirming")
  useEffect(() => {
    if (phase !== "confirming" || !destination || !origin) {
      setPreviewRouteCoords([]);
      return;
    }
    // Só gerar prévia se ainda não tem rota real
    if (routeCoordinates.length > 0) return;
    let cancelled = false;
    (async () => {
      const result = await getRoute(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      );
      if (!cancelled) {
        setPreviewRouteCoords(result?.polylineCoords ?? []);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, destination?.lat, destination?.lng, origin?.lat, origin?.lng]);

  async function handleDestinationSelect(item: { address: string; lat: number; lng: number; placeId?: string }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let lat = item.lat;
    let lng = item.lng;

    // Se veio do Google Places (lat/lng = 0), buscar coordenadas reais
    if (item.placeId && (lat === 0 || lng === 0)) {
      const details = await getPlaceDetails(item.placeId);
      if (details) { lat = details.lat; lng = details.lng; }
    }

    const loc: Location = { address: item.address, lat, lng };
    setDestination(loc);
    setSearchText(item.address);
    setPhase("confirming");
  }

  function handleRequestRide() {
    if (!destination) return;
    if (!user?.isApproved) {
      alert("Sua conta ainda não foi aprovada. Envie seu documento RG e aguarde a verificação.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const distanceKm = Math.sqrt(
      Math.pow((destination.lat - origin.lat) * 111, 2) +
      Math.pow((destination.lng - origin.lng) * 111 * Math.cos(origin.lat * Math.PI / 180), 2)
    );
    requestRide(origin, destination, selectedRideType, Math.max(distanceKm, 1), user?.id ?? "guest", user?.name ?? "Passageiro");
  }

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelRide();
    resetRide();
    setPhase("idle");
    setDestination(null);
    setSearchText("");
  }

  async function handleRate() {
    await rateDriver(selectedStars);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("idle");
    setDestination(null);
    setSearchText("");
  }

  const distKm = destination
    ? Math.max(1, Math.sqrt(
        Math.pow((destination.lat - origin.lat) * 111, 2) +
        Math.pow((destination.lng - origin.lng) * 111 * Math.cos(origin.lat * Math.PI / 180), 2)
      ))
    : 3;
  const priceInfo = destination ? calculatePrice(distKm, selectedRideType) : { total: 0, surgeMultiplier: 1, isPeakHour: false };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {(phase === "driver_coming" || phase === "in_progress") && (
        <SOSButton onPress={() => triggerSOS()} />
      )}
      <AppMap
        origin={origin}
        destination={destination}
        originColor={colors.primary}
        destColor={colors.accent}
        mode="passenger"
        routeCoordinates={routeCoordinates.length > 0 ? routeCoordinates : previewRouteCoords}
        driverRealtimeLocation={driverRealtimeLocation}
        onMapPress={
          (phase === "idle" || phase === "typing" || phase === "confirming") && user?.isApproved
            ? (loc) => {
                setDestination(loc);
                setSearchText(loc.address);
                setPhase("confirming");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            : undefined
        }
      />

      {currentRide && user && (
        <RideChat
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          rideId={currentRide.id}
          myId={user.id}
          myName={user.name}
          otherName={currentRide.driver?.name ?? "Motorista"}
          socket={socket}
          messages={chatMessages}
          onNewMessage={(msg) => setChatMessages((prev) => [...prev, msg])}
        />
      )}

      {/* Header de busca */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          {phase === "idle" || phase === "typing" ? (
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Para onde vamos?"
              placeholderTextColor={colors.mutedForeground}
              value={searchText}
              onChangeText={(t) => { setSearchText(t); setPhase("typing"); }}
              onFocus={() => setPhase("typing")}
              returnKeyType="search"
            />
          ) : (
            <Text style={[styles.searchInput, { color: colors.foreground }]} numberOfLines={1}>
              {destination?.address ?? "Para onde vamos?"}
            </Text>
          )}
          {(phase === "idle" || phase === "typing" || phase === "confirming") && (
            <TouchableOpacity onPress={() => { setPhase("idle"); setSearchText(""); setDestination(null); }}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: botPad + 16 }]}>

        {/* IDLE: conta pendente de aprovação */}
        {phase === "idle" && !user?.isApproved && (
          <View style={styles.emptyState}>
            <View style={[styles.approvalBadge, { backgroundColor: "#FFD60A22" }]}>
              <Feather name="clock" size={32} color="#FFD60A" />
            </View>
            <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>Conta em análise</Text>
            <Text style={[styles.emptyStateDesc, { color: colors.mutedForeground }]}>
              Seu documento (RG) está sendo verificado pela equipe.{"\n"}Você poderá solicitar corridas após aprovação.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(passenger)/upload-documents")}
              style={[styles.requestBtn, { backgroundColor: colors.primary, paddingHorizontal: 28, marginTop: 8 }]}
            >
              <Text style={styles.requestBtnText}>Ver meus documentos</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* IDLE: estado vazio (aprovado) */}
        {phase === "idle" && user?.isApproved && (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>Para onde vamos?</Text>
            <Text style={[styles.emptyStateDesc, { color: colors.mutedForeground }]}>
              Busque seu destino acima ou toque no mapa
            </Text>
          </View>
        )}

        {/* TYPING: resultados da busca */}
        {phase === "typing" && (
          <View>
            {searchResults.length > 0 ? (
              <>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Resultados</Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.address}
                  scrollEnabled={false}
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
              </>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="search" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyStateDesc, { color: colors.mutedForeground }]}>
                  Buscando endereços...
                </Text>
              </View>
            )}
          </View>
        )}

        {/* CONFIRMING: opções de corrida */}
        {phase === "confirming" && destination && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.routeInfo}>
              <View style={[styles.routeRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.routeText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {origin.address}
                </Text>
              </View>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                  {destination.address}
                </Text>
              </View>
            </View>

            <Text style={[styles.sheetTitle, { color: colors.foreground, marginTop: 16 }]}>Escolha o tipo</Text>
            {RIDE_OPTIONS.map((opt) => {
              const { total: optPrice, isPeakHour } = calculatePrice(distKm, opt.type);
              const selected = selectedRideType === opt.type;
              return (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.rideOption, {
                    backgroundColor: selected ? colors.primary : colors.muted,
                    borderColor: selected ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setSelectedRideType(opt.type); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.rideOptionLeft}>
                    <Feather name="navigation" size={20} color={selected ? "#fff" : colors.foreground} />
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.rideLabel, { color: selected ? "#fff" : colors.foreground }]}>{opt.label}</Text>
                        {isPeakHour && (
                          <View style={{ backgroundColor: "#FFD60A", paddingHorizontal: 4, borderRadius: 4 }}>
                            <Text style={{ fontSize: 8, color: "#000", fontFamily: "Inter_700Bold" }}>⚡ PICO</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.rideDesc, { color: selected ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>{opt.desc}</Text>
                    </View>
                  </View>
                  <Text style={[styles.ridePrice, { color: selected ? "#fff" : colors.foreground }]}>
                    R$ {optPrice.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.requestBtn, { backgroundColor: colors.primary }]}
              onPress={handleRequestRide}
              activeOpacity={0.85}
            >
              <Text style={styles.requestBtnText}>Solicitar corrida — R$ {priceInfo.total.toFixed(2)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.muted, marginTop: 10 }]}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* FINDING — Radar animado */}
        {phase === "finding" && (() => {
          const ring1Scale = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
          const ring1Opacity = ring1Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 0.5, 0] });
          const ring2Scale = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
          const ring2Opacity = ring2Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 0.5, 0] });
          const ring3Scale = ring3Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
          const ring3Opacity = ring3Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 0.5, 0] });

          return (
            <View style={styles.findingWrapper}>
              {/* Radar */}
              <View style={styles.radarContainer}>
                <Animated.View style={[styles.radarRing, { borderColor: colors.primary, opacity: ring1Opacity, transform: [{ scale: ring1Scale }] }]} />
                <Animated.View style={[styles.radarRing, { borderColor: colors.primary, opacity: ring2Opacity, transform: [{ scale: ring2Scale }] }]} />
                <Animated.View style={[styles.radarRing, { borderColor: colors.primary, opacity: ring3Opacity, transform: [{ scale: ring3Scale }] }]} />
                <Animated.View style={[styles.radarCore, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }]}>
                  <Feather name="navigation" size={30} color="#fff" />
                </Animated.View>
              </View>

              {/* Título com reticências */}
              <View style={styles.findingTitleRow}>
                <Text style={[styles.findingTitle, { color: colors.foreground }]}>Procurando motorista parceiro</Text>
                <AnimatedDots anim={dotsAnim} color={colors.primary} />
              </View>
              <Text style={[styles.findingDesc, { color: colors.mutedForeground }]}>
                Conectando você ao melhor parceiro próximo
              </Text>

              {/* Destino */}
              {destination && (
                <View style={[styles.findingDestBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="map-pin" size={14} color={colors.accent} />
                  <Text style={[styles.findingDestText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {destination.address}
                  </Text>
                </View>
              )}

              {/* Preço estimado */}
              <View style={[styles.findingPriceRow, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
                <Feather name="dollar-sign" size={14} color={colors.primary} />
                <Text style={[styles.findingPriceLabel, { color: colors.mutedForeground }]}>Valor estimado</Text>
                <Text style={[styles.findingPriceValue, { color: colors.primary }]}>
                  R$ {priceInfo.total.toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancelar busca</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* DRIVER COMING */}
        {phase === "driver_coming" && currentRide?.driver && (
          <View>
            <View style={[styles.driverBanner, { backgroundColor: colors.success + "22" }]}>
              <Feather name="user-check" size={16} color={colors.success} />
              <Text style={[styles.driverBannerText, { color: colors.success }]}>
                Motorista a caminho — {currentRide.driver.eta} min
              </Text>
            </View>
            <View style={styles.driverCard}>
              <View style={[styles.driverAvatar, { backgroundColor: colors.secondary }]}>
                <Text style={styles.driverAvatarText}>{currentRide.driver.photo ?? currentRide.driver.name[0]}</Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: colors.foreground }]}>{currentRide.driver.name}</Text>
                <Text style={[styles.driverMeta, { color: colors.mutedForeground }]}>
                  ⭐ {currentRide.driver.rating.toFixed(1)} · {currentRide.driver.car} {currentRide.driver.color}
                </Text>
                <Text style={[styles.driverMeta, { color: colors.mutedForeground }]}>
                  🔑 {currentRide.driver.plate}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.chatBtn, { backgroundColor: colors.accent + "22" }]}
                onPress={() => { setChatOpen(true); setUnreadCount(0); }}
              >
                <Feather name="message-circle" size={22} color={colors.accent} />
                {unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#FF6B00" }]}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
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
              <TouchableOpacity
                style={[styles.sosBtn, { backgroundColor: colors.destructive }]}
                onPress={() => { triggerSOS(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }}
                activeOpacity={0.8}
              >
                <Feather name="alert-triangle" size={16} color="#fff" />
                <Text style={styles.sosText}>SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelRideBtn, { borderColor: colors.border }]}
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelRideText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* IN PROGRESS */}
        {phase === "in_progress" && currentRide?.driver && (
          <View>
            <View style={[styles.driverBanner, { backgroundColor: colors.accent + "22" }]}>
              <Feather name="navigation" size={16} color={colors.accent} />
              <Text style={[styles.driverBannerText, { color: colors.accent }]}>Corrida em andamento</Text>
            </View>
            <View style={styles.driverCard}>
              <View style={[styles.driverAvatar, { backgroundColor: colors.secondary }]}>
                <Text style={styles.driverAvatarText}>{currentRide.driver.photo ?? currentRide.driver.name[0]}</Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: colors.foreground }]}>{currentRide.driver.name}</Text>
                <Text style={[styles.driverMeta, { color: colors.mutedForeground }]}>
                  {currentRide.destination.address}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.chatBtn, { backgroundColor: colors.accent + "22" }]}
                onPress={() => { setChatOpen(true); setUnreadCount(0); }}
              >
                <Feather name="message-circle" size={22} color={colors.accent} />
                {unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#FF6B00" }]}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sosBtn, { backgroundColor: colors.destructive, width: "100%" }]}
              onPress={() => { triggerSOS(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }}
              activeOpacity={0.8}
            >
              <Feather name="alert-triangle" size={16} color="#fff" />
              <Text style={styles.sosText}>Acionar SOS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RATING */}
        {phase === "rating" && (
          <View style={styles.centerContent}>
            <View style={[styles.ratingIcon, { backgroundColor: colors.success + "22" }]}>
              <Text style={{ fontSize: 40 }}>⭐</Text>
            </View>
            <Text style={[styles.findingTitle, { color: colors.foreground }]}>Corrida finalizada!</Text>
            <Text style={[styles.findingDesc, { color: colors.mutedForeground }]}>
              Como foi sua experiência?
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => { setSelectedStars(s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={{ fontSize: 36, opacity: s <= selectedStars ? 1 : 0.3 }}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.requestBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
              onPress={handleRate}
              activeOpacity={0.85}
            >
              <Text style={styles.requestBtnText}>Enviar avaliação</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, height: 52,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  bottomSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1,
    paddingHorizontal: 20, paddingTop: 20, maxHeight: "55%",
  },
  sheetTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  destRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  destIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  destText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  routeInfo: { marginBottom: 4 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  rideOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  rideOptionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rideLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  rideDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ridePrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  requestBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  requestBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  cancelBtn: { flexDirection: "row", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  centerContent: { alignItems: "center", paddingVertical: 16, gap: 10 },
  pulseCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  findingTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  findingDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  driverBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  driverBannerText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
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
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 10 },
  emptyStateTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyStateDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  approvalBadge: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },

  // ── Finding / Radar ──────────────────────────────────────────────────────────
  findingWrapper: { alignItems: "center", paddingVertical: 8, gap: 12 },
  radarContainer: {
    width: 100, height: 100, alignItems: "center", justifyContent: "center",
    marginVertical: 8,
  },
  radarRing: {
    position: "absolute",
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2,
  },
  radarCore: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  findingTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  findingDestBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 10, width: "100%",
  },
  findingDestText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  findingPriceRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 10, width: "100%",
  },
  findingPriceLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  findingPriceValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
