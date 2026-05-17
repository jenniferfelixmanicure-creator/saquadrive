import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { API_URL } from "@/constants/api";

type DriverStats = {
  todayRides: number;
  weekRides: number;
  totalRides: number;
};

type Goal = {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  current: number;
  target: number;
  unit: string;
  reward: string;
};

function GoalBar({ current, target, color }: { current: number; target: number; color: string }) {
  const pct = Math.min(current / target, 1);
  return (
    <View style={{ height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
      <View style={{ height: 6, width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function DriverGoalsScreen() {
  const colors = useColors();
  const { user, apiFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [stats, setStats] = useState<DriverStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch("/api/rides/driver/stats");
      if (res.ok) {
        const data = await res.json() as DriverStats;
        setStats(data);
      }
    } catch {
      // silencioso
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const goals: Goal[] = [
    {
      id: "rides",
      icon: "navigation",
      title: "Corridas do dia",
      desc: "Complete corridas hoje",
      current: stats?.todayRides ?? 0,
      target: 10,
      unit: "corridas",
      reward: "R$ 20,00 bônus",
    },
    {
      id: "rating",
      icon: "star",
      title: "Avaliação 5★",
      desc: "Receba avaliações 5 estrelas hoje",
      current: 0,
      target: 5,
      unit: "avaliações",
      reward: "R$ 10,00 bônus",
    },
    {
      id: "total",
      icon: "award",
      title: "Marco de corridas",
      desc: "Corridas concluídas no total",
      current: stats?.totalRides ?? 0,
      target: Math.ceil(((stats?.totalRides ?? 0) + 1) / 10) * 10,
      unit: "corridas",
      reward: "Distintivo especial",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Metas do dia</Text>
        <TouchableOpacity onPress={fetchStats} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C4FF" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Carregando metas...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.infoBanner, { backgroundColor: "#00C4FF18", borderColor: "#00C4FF44" }]}>
            <Feather name="target" size={16} color="#00C4FF" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBannerTitle, { color: "#00C4FF" }]}>Metas em tempo real</Text>
              <Text style={[styles.infoBannerDesc, { color: "#00C4FF" }]}>
                Cumpra as metas e ganhe bônus extras. Dados atualizados do servidor.
              </Text>
            </View>
          </View>

          {goals.map((goal) => {
            const done = goal.current >= goal.target;
            return (
              <View
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: colors.card, borderColor: done ? colors.success + "55" : colors.border }]}
              >
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIcon, { backgroundColor: done ? colors.success + "22" : "#00C4FF22" }]}>
                    <Feather name={goal.icon} size={20} color={done ? colors.success : "#00C4FF"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalTitle, { color: colors.foreground }]}>{goal.title}</Text>
                    <Text style={[styles.goalDesc, { color: colors.mutedForeground }]}>{goal.desc}</Text>
                  </View>
                  {done && (
                    <View style={[styles.doneBadge, { backgroundColor: colors.success + "22" }]}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={[styles.doneBadgeText, { color: colors.success }]}>Concluída</Text>
                    </View>
                  )}
                </View>

                <GoalBar current={goal.current} target={goal.target} color={done ? colors.success : "#00C4FF"} />

                <View style={styles.goalFooter}>
                  <Text style={[styles.goalProgress, { color: colors.foreground }]}>
                    {goal.current} / {goal.target} {goal.unit}
                  </Text>
                  <View style={[styles.rewardBadge, { backgroundColor: colors.muted }]}>
                    <Feather name="gift" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.rewardText, { color: colors.mutedForeground }]}>{goal.reward}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  content: { padding: 16, gap: 12 },
  infoBanner: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  infoBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  infoBannerDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  goalCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  goalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  goalTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  goalDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  doneBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  goalFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalProgress: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rewardBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rewardText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
