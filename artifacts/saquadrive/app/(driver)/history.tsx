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
import { router } from "expo-router";
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
  passengerStars: number | null;
  createdAt: string;
};

type HistoryResponse = {
  items: ApiRide[];
  hasMore: boolean;
  nextCursor: string | null;
};

type Stats = {
  totalRides: number;
  totalEarnings: number;
  weekRides: number;
  weekEarnings: number;
  monthRides: number;
  monthEarnings: number;
  todayRides: number;
  rating: number;
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Concluída",
  cancelled: "Cancelada",
  in_progress: "Em andamento",
  accepted: "Aceita",
};

function StatsCard({ stats, colors }: { stats: Stats; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            R$ {Number(stats.todayRides > 0 ? stats.weekEarnings / 7 : 0).toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Hoje (est.)</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            R$ {Number(stats.weekEarnings).toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Esta semana</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            R$ {Number(stats.monthEarnings).toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Este mês</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.earningsBtn, { borderColor: colors.border }]}
        onPress={() => router.push("/(driver)/earnings")}
        activeOpacity={0.85}
      >
        <Feather name="dollar-sign" size={14} color={colors.success} />
        <Text style={[styles.earningsBtnText, { color: colors.success }]}>Ver ganhos detalhados</Text>
        <Feather name="chevron-right" size={14} color={colors.success} />
      </TouchableOpacity>
      <View style={[styles.statsFooter, { borderTopColor: colors.border }]}>
        <View style={styles.chip}>
          <Feather name="star" size={13} color="#FFD60A" />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{Number(stats.rating).toFixed(1)}</Text>
          <Text style={[styles.chipLabel, { color: colors.mutedForeground }]}>avaliação</Text>
        </View>
        <View style={styles.chip}>
          <Feather name="check-circle" size={13} color={colors.success} />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{stats.totalRides}</Text>
          <Text style={[styles.chipLabel, { color: colors.mutedForeground }]}>corridas total</Text>
        </View>
        <View style={styles.chip}>
          <Feather name="trending-up" size={13} color={colors.primary} />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{stats.weekRides}</Text>
          <Text style={[styles.chipLabel, { color: colors.mutedForeground }]}>na semana</Text>
        </View>
      </View>
    </View>
  );
}

function RideItem({ item, colors }: { item: ApiRide; colors: ReturnType<typeof useColors> }) {
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const price = parseFloat(item.price);
  const rideLabel = RIDE_LABELS[item.rideType] ?? item.rideType;

  const statusColor =
    item.status === "completed" ? colors.success :
    item.status === "cancelled" ? "#FF453A" :
    colors.mutedForeground;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: colors.success + "20" }]}>
          <Feather name="navigation" size={18} color={colors.success} />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{dateStr} · {timeStr}</Text>
          <Text style={[styles.typeText, { color: colors.foreground }]}>{rideLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Text style={[styles.priceText, { color: colors.success }]}>R$ {price.toFixed(2)}</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABEL[item.status] ?? "Aguardando"}
          </Text>
        </View>
      </View>

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

      <View style={styles.chips}>
        {item.distance && (
          <View style={styles.chipRow}>
            <Feather name="map" size={12} color={colors.mutedForeground} />
            <Text style={[styles.chipRowText, { color: colors.mutedForeground }]}>{item.distance}</Text>
          </View>
        )}
        {item.duration && (
          <View style={styles.chipRow}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.chipRowText, { color: colors.mutedForeground }]}>{item.duration}</Text>
          </View>
        )}
        {item.passengerStars != null && (
          <View style={styles.chipRow}>
            <Feather name="star" size={12} color="#FFD60A" />
            <Text style={[styles.chipRowText, { color: colors.mutedForeground }]}>
              {item.passengerStars}.0 do passageiro
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function DriverHistoryScreen() {
  const { apiFetch } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  const [rides, setRides] = useState<ApiRide[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (nextCursor?: string) => {
    if (!nextCursor) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        apiFetch(nextCursor
          ? `/api/rides/driver/history?cursor=${encodeURIComponent(nextCursor)}&limit=20`
          : "/api/rides/driver/history?limit=20"),
        !nextCursor ? apiFetch("/api/rides/driver/stats") : Promise.resolve(null),
      ]);
      if (!histRes.ok) throw new Error(`Erro ${histRes.status}`);
      const data = await histRes.json() as HistoryResponse;
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setRides((prev) => nextCursor ? [...prev, ...items] : items);
      setHasMore(Array.isArray(data) ? false : (data.hasMore ?? false));
      setCursor(Array.isArray(data) ? null : (data.nextCursor ?? null));
      if (statsRes && statsRes.ok) {
        const s = await statsRes.json() as Stats;
        setStats(s);
      }
    } catch {
      setError("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#0D2E1A", "#0D0D0D"]} style={[styles.topGrad, { height: topPad + 90 }]} />

      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Minhas corridas</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.success} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
          <TouchableOpacity onPress={() => fetchHistory()} style={[styles.retryBtn, { backgroundColor: colors.success }]}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingTop: 12, paddingBottom: botPad + 16 }]}
          renderItem={({ item }) => <RideItem item={item} colors={colors} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={stats ? <StatsCard stats={stats} colors={colors} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="navigation" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma corrida ainda</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Suas corridas concluídas aparecerão aqui
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
                  ? <ActivityIndicator size="small" color={colors.success} />
                  : <Text style={[styles.loadMoreText, { color: colors.success }]}>Carregar mais</Text>}
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
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  statsCard: { borderRadius: 16, borderWidth: 1, marginHorizontal: 16, marginBottom: 12, overflow: "hidden" },
  statsRow: { flexDirection: "row", paddingVertical: 16 },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, marginVertical: 8 },
  statsFooter: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  chipLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
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
  chips: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chipRowText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", gap: 12, paddingTop: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
  earningsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderTopWidth: 1, paddingVertical: 12 },
  earningsBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  loadMore: { margin: 16, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  loadMoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
