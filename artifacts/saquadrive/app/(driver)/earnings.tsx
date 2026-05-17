import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
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
import { API_URL } from "@/constants/api";

type Period = "hoje" | "semana" | "mes";

type ApiRide = {
  id: string;
  originAddress: string;
  destAddress: string;
  rideType: string;
  price: string;
  status: string;
  distance: string | null;
  duration: string | null;
  createdAt: string;
};

type DisplayRide = {
  id: string;
  time: string;
  origin: string;
  destination: string;
  price: number;
  distance: string;
};

function isSameDay(date: Date, ref: Date) {
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  );
}

function filterByPeriod(rides: ApiRide[], period: Period): ApiRide[] {
  const now = new Date();
  return rides.filter((r) => {
    if (r.status !== "completed") return false;
    const d = new Date(r.createdAt);
    if (period === "hoje") return isSameDay(d, now);
    if (period === "semana") {
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
}

function toDisplay(ride: ApiRide): DisplayRide {
  const d = new Date(ride.createdAt);
  return {
    id: ride.id,
    time: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`,
    origin: ride.originAddress,
    destination: ride.destAddress,
    price: parseFloat(ride.price),
    distance: ride.distance ?? "—",
  };
}

export default function EarningsScreen() {
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("hoje");
  const [allRides, setAllRides] = useState<ApiRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  const fetchRides = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rides/driver/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as ApiRide[];
      setAllRides(data);
    } catch {
      setError("Não foi possível carregar os ganhos. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  const periodRides = filterByPeriod(allRides, period);
  const data = periodRides.map(toDisplay);

  const totalEarnings = data.reduce((s, r) => s + r.price, 0);
  const totalRides = data.length;
  // Estimativa de horas: média de 15 min por corrida
  const estHours = Math.max(0.5, totalRides * 0.25);

  // Para o gráfico de barras: agrupa por hora (hoje) ou dia (semana/mês)
  const barData = (() => {
    if (period === "hoje") {
      const byHour: Record<string, number> = {};
      for (const r of periodRides) {
        const h = new Date(r.createdAt).getHours();
        const key = `${h.toString().padStart(2, "0")}h`;
        byHour[key] = (byHour[key] ?? 0) + parseFloat(r.price);
      }
      return Object.entries(byHour).slice(-5).map(([label, price]) => ({ label, price }));
    }
    if (period === "semana") {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const byDay: Record<string, number> = {};
      for (const r of periodRides) {
        const label = days[new Date(r.createdAt).getDay()];
        byDay[label] = (byDay[label] ?? 0) + parseFloat(r.price);
      }
      return Object.entries(byDay).map(([label, price]) => ({ label, price }));
    }
    // mês: por semana
    const byWeek: Record<string, number> = {};
    for (const r of periodRides) {
      const day = new Date(r.createdAt).getDate();
      const week = `Sem ${Math.ceil(day / 7)}`;
      byWeek[week] = (byWeek[week] ?? 0) + parseFloat(r.price);
    }
    return Object.entries(byWeek).map(([label, price]) => ({ label, price }));
  })();

  const maxBar = barData.length > 0 ? Math.max(...barData.map((b) => b.price), 1) : 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0D1A2E", "#0D0D0D"]}
        style={[styles.topGrad, { height: topPad + 220 }]}
      />

      {loading ? (
        <View style={[styles.centered, { paddingTop: topPad + 40 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Carregando ganhos...
          </Text>
        </View>
      ) : error ? (
        <View style={[styles.centered, { paddingTop: topPad + 40 }]}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
          <TouchableOpacity
            onPress={fetchRides}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: botPad + 16 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Header */}
              <View style={[styles.header, { paddingTop: topPad + 16 }]}>
                <Text style={[styles.title, { color: colors.foreground }]}>Ganhos</Text>

                {/* Period toggle */}
                <View style={[styles.periodRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {(["hoje", "semana", "mes"] as Period[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.periodBtn,
                        { backgroundColor: period === p ? colors.primary : "transparent" },
                      ]}
                      onPress={() => setPeriod(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.periodLabel, { color: period === p ? "#fff" : colors.mutedForeground }]}>
                        {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Total card */}
                <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.totalMain}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                      Total {period === "hoje" ? "hoje" : period === "semana" ? "esta semana" : "este mês"}
                    </Text>
                    <Text style={[styles.totalValue, { color: colors.foreground }]}>
                      R$ {totalEarnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.totalStats}>
                    <View style={styles.totalStat}>
                      <Feather name="navigation" size={14} color={colors.primary} />
                      <Text style={[styles.totalStatNum, { color: colors.foreground }]}>{totalRides}</Text>
                      <Text style={[styles.totalStatLabel, { color: colors.mutedForeground }]}>corridas</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.totalStat}>
                      <Feather name="clock" size={14} color={colors.accent} />
                      <Text style={[styles.totalStatNum, { color: colors.foreground }]}>{estHours.toFixed(1)}h</Text>
                      <Text style={[styles.totalStatLabel, { color: colors.mutedForeground }]}>estimado</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.totalStat}>
                      <Feather name="trending-up" size={14} color={colors.success} />
                      <Text style={[styles.totalStatNum, { color: colors.foreground }]}>
                        R$ {totalRides > 0 ? (totalEarnings / estHours).toFixed(0) : "0"}
                      </Text>
                      <Text style={[styles.totalStatLabel, { color: colors.mutedForeground }]}>/hora</Text>
                    </View>
                  </View>
                </View>

                {/* Bar chart */}
                {barData.length > 0 ? (
                  <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.chartTitle, { color: colors.foreground }]}>Distribuição</Text>
                    <View style={styles.bars}>
                      {barData.slice(0, 5).map((item) => {
                        const pct = Math.min(item.price / maxBar, 1);
                        return (
                          <View key={item.label} style={styles.barGroup}>
                            <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                              <View
                                style={[
                                  styles.barFill,
                                  { height: `${Math.max(pct * 100, 8)}%` as never, backgroundColor: colors.primary },
                                ]}
                              />
                            </View>
                            <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <Text style={[styles.listTitle, { color: colors.mutedForeground }]}>
                  {period === "hoje" ? "Corridas de hoje" : period === "semana" ? "Esta semana" : "Este mês"}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.rideRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.rideIconBox, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="navigation" size={16} color={colors.primary} />
              </View>
              <View style={styles.rideInfo}>
                <Text style={[styles.rideTime, { color: colors.mutedForeground }]}>{item.time}</Text>
                <Text style={[styles.rideRoute, { color: colors.foreground }]} numberOfLines={1}>
                  {item.origin} → {item.destination}
                </Text>
                <Text style={[styles.rideDistance, { color: colors.mutedForeground }]}>{item.distance}</Text>
              </View>
              <Text style={[styles.ridePrice, { color: colors.success }]}>
                +R$ {item.price.toFixed(2)}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="dollar-sign" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Nenhuma corrida {period === "hoje" ? "hoje" : period === "semana" ? "esta semana" : "este mês"}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Complete corridas para ver seus ganhos aqui
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  header: { paddingHorizontal: 16, gap: 14, marginBottom: 14 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  periodRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  periodLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  totalCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  totalMain: { gap: 4 },
  totalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  totalStats: { flexDirection: "row", alignItems: "center", gap: 16 },
  totalStat: { flex: 1, alignItems: "center", gap: 4 },
  totalStatNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  totalStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 28 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  chartTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 80 },
  barGroup: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barTrack: { flex: 1, width: "100%", borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 6, minHeight: 6 },
  barLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  listTitle: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 4, paddingHorizontal: 4,
  },
  rideRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, padding: 14, borderRadius: 14, borderWidth: 1,
  },
  rideIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rideInfo: { flex: 1 },
  rideTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  rideRoute: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rideDistance: { fontSize: 11, fontFamily: "Inter_400Regular" },
  ridePrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", gap: 10, paddingTop: 40, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
