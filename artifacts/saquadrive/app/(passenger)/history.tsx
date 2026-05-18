import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type ApiRide = {
  id: string;
  originAddress: string;
  originLat: string;
  originLng: string;
  destAddress: string;
  destLat: string;
  destLng: string;
  rideType: string;
  price: string;
  status: string;
  distance: string | null;
  duration: string | null;
  passengerRating: number | null;
  createdAt: string;
  driver: {
    name: string;
    rating: string | null;
    vehicleModel: string | null;
    vehiclePlate: string | null;
    vehicleColor: string | null;
  } | null;
};

function RideItem({ item, colors }: { item: ApiRide; colors: ReturnType<typeof useColors> }) {
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const price = parseFloat(item.price);

  const statusColor =
    item.status === "completed" ? colors.success :
    item.status === "cancelled" ? "#FF453A" :
    colors.mutedForeground;

  const statusLabel =
    item.status === "completed" ? "Concluída" :
    item.status === "cancelled" ? "Cancelada" :
    item.status === "in_progress" ? "Em andamento" :
    item.status === "accepted" ? "Aceita" : "Buscando";

  return (
    <View style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rideHeader}>
        <View style={[styles.rideIconBox, { backgroundColor: colors.primary + "22" }]}>
          <Feather name="navigation" size={18} color={colors.primary} />
        </View>
        <View style={styles.rideMeta}>
          <Text style={[styles.rideDate, { color: colors.mutedForeground }]}>
            {dateStr} · {timeStr}
          </Text>
          <Text style={[styles.rideType, { color: colors.foreground }]}>
            {item.rideType.charAt(0).toUpperCase() + item.rideType.slice(1)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[styles.ridePrice, { color: colors.primary }]}>
            R$ {price.toFixed(2)}
          </Text>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={[styles.routeLine, { borderColor: colors.border }]}>
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.addr, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.originAddress}
          </Text>
        </View>
        <View style={[styles.connector, { backgroundColor: colors.border }]} />
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.addr, { color: colors.foreground }]} numberOfLines={1}>
            {item.destAddress}
          </Text>
        </View>
      </View>

      <View style={styles.rideFooter}>
        {item.distance && (
          <View style={styles.footerItem}>
            <Feather name="map" size={13} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {item.distance}
            </Text>
          </View>
        )}
        {item.duration && (
          <View style={styles.footerItem}>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {item.duration}
            </Text>
          </View>
        )}
        {item.passengerRating && (
          <View style={styles.footerItem}>
            <Feather name="star" size={13} color="#FFD60A" />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {item.passengerRating}.0
            </Text>
          </View>
        )}
        {item.driver && (
          <View style={styles.footerItem}>
            <Feather name="user" size={13} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {item.driver.name.split(" ")[0]}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { apiFetch } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  const [rides, setRides] = useState<ApiRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30000)
      );
      const res = await Promise.race([
        apiFetch("/api/rides/history"),
        timeoutPromise,
      ]);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as ApiRide[];
      setRides(data);
    } catch {
      setError("Não foi possível carregar o histórico. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0D1A2E", "#0D0D0D"]}
        style={[styles.topGrad, { height: topPad + 80 }]}
      />
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Minhas corridas</Text>
        {rides.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>
              {rides.length}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
          <TouchableOpacity
            onPress={fetchHistory}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingTop: 16, paddingBottom: botPad + 16 },
          ]}
          renderItem={({ item }) => <RideItem item={item} colors={colors} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="map" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Nenhuma corrida ainda
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Suas corridas aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rideCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  rideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rideIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rideMeta: { flex: 1 },
  rideDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  rideType: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ridePrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  routeLine: { gap: 4, paddingLeft: 4, borderLeftWidth: 0 },
  routePoint: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connector: { height: 12, width: 2, marginLeft: 3, marginVertical: 2 },
  addr: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  rideFooter: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", gap: 12, paddingTop: 80 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
