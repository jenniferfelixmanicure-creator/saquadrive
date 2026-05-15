import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Reward = {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  points: number;
  locked: boolean;
};

const REWARDS: Reward[] = [
  { id: "1", icon: "star", title: "Motorista Destaque", desc: "Complete 50 corridas com avaliação acima de 4.8", points: 500, locked: false },
  { id: "2", icon: "zap", title: "Relâmpago", desc: "Complete 10 corridas em menos de 5 minutos de espera", points: 200, locked: false },
  { id: "3", icon: "shield", title: "Risco Zero", desc: "Não receba nenhuma reclamação em 30 dias", points: 300, locked: true },
  { id: "4", icon: "trending-up", title: "Em Ascensão", desc: "Aumente seus ganhos por 3 semanas consecutivas", points: 400, locked: true },
  { id: "5", icon: "award", title: "Top Saquarema", desc: "Seja o motorista com maior número de corridas no mês", points: 1000, locked: true },
];

const USER_POINTS = 700;

export default function DriverRewardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Recompensas</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.pointsCard, { backgroundColor: "#00C4FF" }]}>
          <Feather name="award" size={32} color="#fff" />
          <Text style={styles.pointsValue}>{USER_POINTS.toLocaleString("pt-BR")}</Text>
          <Text style={styles.pointsLabel}>PONTOS ACUMULADOS</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CONQUISTAS</Text>

        {REWARDS.map((reward) => (
          <View
            key={reward.id}
            style={[
              styles.rewardCard,
              {
                backgroundColor: colors.card,
                borderColor: reward.locked ? colors.border : "#00C4FF55",
                opacity: reward.locked ? 0.65 : 1,
              },
            ]}
          >
            <View style={[styles.rewardIcon, { backgroundColor: reward.locked ? colors.muted : "#00C4FF22" }]}>
              <Feather name={reward.locked ? "lock" : reward.icon} size={22} color={reward.locked ? colors.mutedForeground : "#00C4FF"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rewardTitle, { color: colors.foreground }]}>{reward.title}</Text>
              <Text style={[styles.rewardDesc, { color: colors.mutedForeground }]}>{reward.desc}</Text>
            </View>
            <View style={[styles.pointsBadge, { backgroundColor: reward.locked ? colors.muted : "#00C4FF22" }]}>
              <Text style={[styles.pointsBadgeText, { color: reward.locked ? colors.mutedForeground : "#00C4FF" }]}>
                +{reward.points}pts
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
  content: { padding: 16, gap: 12 },
  pointsCard: {
    borderRadius: 20, padding: 24,
    alignItems: "center", gap: 8,
  },
  pointsValue: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -2 },
  pointsLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.75)", letterSpacing: 1.5 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8,
    textTransform: "uppercase", marginTop: 4,
  },
  rewardCard: {
    borderRadius: 16, borderWidth: 1, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  rewardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rewardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  rewardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  pointsBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  pointsBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
