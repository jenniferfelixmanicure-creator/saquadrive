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

const RIDE_LABELS: Record<string, string> = {
  moto: "ZeroFlash",
  basico: "ZeroRisk",
  intermediario: "ZeroPlus",
  vip: "ZeroGold",
};

type ApiRide = {
  id: string;
  originAddress: string;
  destAddress: string;
  rideType: string;
  price: string;
  status: string;
  distance: string | null;
  duration: string | null;
  passengerRating: number | null;
  promoCode: string | null;
  promoDiscount: string | null;
  waitTimeFee: string | null;
  createdAt: string;
  completedAt: string | null;
  driverName: string | null;
  driverRating: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleColor: string | null;
};

type HistoryResponse = {
  items: ApiRide[];
  hasMore: boolean;
  nextCursor: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Concluída",
  cancelled: "Cancelada",
  in_progress: "Em andamento",
  accepted: "Aceita",
};

function RideItem({ item, colors }: { item: ApiRide; colors: ReturnType<typeof useColors> }) {
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const price = parseFloat(item.price);
  const discount = item.promoDiscount ? parseFloat(item.promoDiscount) : 0;

  const statusColor =
    item.status === "completed" ? colors.success :
    item.status === "cancelled" ? "#FF453A" :
    colors.mutedForeground;

  const rideLabel = RIDE_LABELS[item.rideType] ?? item.rideType;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="navigation" size={18} color={colors.primary} />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{dateStr} · {timeStr}</Text>
          <Text style={[styles.typeText, { color: colors.foreground }]}>{rideLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Text style={[styles.priceText, { color: colors.primary }]}>R$ {price.toFixed(2)}</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABEL[item.status] ?? "Buscando"}
          </Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.addr, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.originAddress}
          </Text>
        </View>
        <View style={[styles.connector, { backgroundColor: colors.border }]} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.addr, { color: colors.foreground }]} numberOfLines={1}>
            {item.destAddress}
          </Text>
        </View>
      </View>

      {/* Footer chips */}
      <View style={styles.chips}>
        {item.distance && (
          <View style={styles.chip}>
            <Feather name="map" size={12} color={colors.mutedForeground} />
            <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.distance}</Text>
          </View>
        )}
        {item.duration && (
          <View style={styles.chip}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.duration}</Text>
          </View>
        )}
        {item.passengerRating != null && (
          <View style={styles.chip}>
            <Feather name="star" size={12} color="#FFD60A" />
            <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.passengerRating}.0</Text>
          </View>
        )}
        {item.driverName && (
          <View style={styles.chip}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
              {item.driverName.split(" ")[0]}
            </Text>
          </View>
        )}
        {item.promoCode && discount > 0 && (
          <View style={[styles.chip, { backgroundColor: "#34C75920" }]}>
            <Feather name="tag" size={12} color="#34C759" />
            <Text style={[styles.chipText, { color: "#34C759" }]}>-R$ {discount.toFixed(2)}</Text>
          </View>
        )}
        {item.waitTimeFee && parseFloat(item.waitTimeFee) > 0 && (
          <View style={[styles.chip, { backgroundColor: "#FF6B0015" }]}>
            <Feather name="clock" size={12} color="#FF6B00" />
            <Text style={[styles.chipText, { color: "#FF6B00" }]}>
              +R$ {parseFloat(item.waitTimeFee).toFixed(2)} espera
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function PassengerHistoryScreen() {
  const { apiFetch } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  const [rides, setRides] = useState<ApiRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (nextCursor?: string) => {
    if (!nextCursor) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const url = nextCursor
        ? `/api/rides/history?cursor=${encodeURIComponent(nextCursor)}&limit=20`
        : "/api/rides/history?limit=20";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as HistoryResponse;
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setRides((prev) => nextCursor ? [...prev, ...items] : items);
      setHasMore(Array.isArray(data) ? false : (data.hasMore ?? false));
      setCursor(Array.isArray(data) ? null : (data.nextCursor ?? null));
    } catch {
      setError("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const totalGasto = rides
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + parseFloat(r.price), 0);
  const concluidas = rides.filter((r) => r.status === "completed").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#0D1A2E", "#0D0D0D"]} style={[styles.topGrad, { height: topPad + 90 }]} />

      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Minhas corridas</Text>
        {rides.length > 0 && (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {concluidas} concluídas · R$ {totalGasto.toFixed(2)} gasto
          </Text>
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
          <TouchableOpacity onPress={() => fetchHistory()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingTop: 16, paddingBottom: botPad + 16 }]}
          renderItem={({ item }) => <RideItem item={item} colors={colors} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="map" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma corrida ainda</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Suas corridas aparecerão aqui
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={[styles.loadMore, { borderColor: colors.border }]}
                onPress={() => fetchHistory(cursor ?? undefined)}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={[styles.loadMoreText, { color: colors.primary }]}>Carregar mais</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  list: { paddingHorizontal: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  meta: { flex: 1 },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  typeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  priceText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  route: { gap: 4, paddingLeft: 4 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connector: { height: 12, width: 2, marginLeft: 3, marginVertical: 2 },
  addr: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  chipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", gap: 12, paddingTop: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loadMore: { margin: 16, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  loadMoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
