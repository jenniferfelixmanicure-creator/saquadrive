import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
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

const TIERS = [
  { name: "Bronze", minRides: 0, color: "#CD7F32", icon: "award" as const, perks: ["Corridas sem taxa de serviço nos finais de semana"] },
  { name: "Prata", minRides: 10, color: "#C0C0C0", icon: "award" as const, perks: ["Prioridade em horários de pico", "5% de desconto em todas as corridas"] },
  { name: "Ouro", minRides: 30, color: "#FFD700", icon: "award" as const, perks: ["10% de desconto permanente", "Suporte prioritário", "Acesso antecipado a promoções"] },
  { name: "Diamante", minRides: 60, color: "#00C4FF", icon: "award" as const, perks: ["15% de desconto permanente", "Motoristas premium", "Linha direta de suporte 24h"] },
];

export default function LoyaltyProgramScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();

  // Usa totalRides do servidor (perfil do usuário) — mais preciso que o histórico local
  const totalRides = (user as { totalRides?: number } | null)?.totalRides ?? 0;

  const currentTier = TIERS.reduce((acc, tier) => {
    if (totalRides >= tier.minRides) return tier;
    return acc;
  }, TIERS[0]);

  const nextTier = TIERS.find((t) => t.minRides > totalRides);
  const ridesUntilNext = nextTier ? nextTier.minRides - totalRides : 0;
  const progressPct = nextTier
    ? Math.min(((totalRides - currentTier.minRides) / (nextTier.minRides - currentTier.minRides)) * 100, 100)
    : 100;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Programa de fidelidade</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#0D1A2E", "#1a2a3a"]} style={styles.tierCard}>
          <View style={styles.tierTop}>
            <View style={[styles.tierIcon, { backgroundColor: currentTier.color + "33", borderColor: currentTier.color + "66" }]}>
              <Feather name="award" size={30} color={currentTier.color} />
            </View>
            <View>
              <Text style={styles.tierLabel}>Seu nível</Text>
              <Text style={[styles.tierName, { color: currentTier.color }]}>{currentTier.name}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.ridesBox}>
              <Text style={styles.ridesNum}>{totalRides}</Text>
              <Text style={styles.ridesLabel}>corridas</Text>
            </View>
          </View>

          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>
                  Próximo nível: <Text style={{ color: nextTier.color }}>{nextTier.name}</Text>
                </Text>
                <Text style={styles.progressLabel}>{ridesUntilNext} restantes</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progressPct)}%` as `${number}%`, backgroundColor: currentTier.color }]} />
              </View>
            </View>
          )}
          {!nextTier && (
            <Text style={styles.maxTierText}>Você alcançou o nível máximo!</Text>
          )}
        </LinearGradient>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SEUS BENEFÍCIOS AGORA</Text>
          {currentTier.perks.map((perk, idx) => (
            <View
              key={idx}
              style={[styles.perkRow, { borderBottomColor: colors.border, borderBottomWidth: idx < currentTier.perks.length - 1 ? 1 : 0 }]}
            >
              <View style={[styles.perkDot, { backgroundColor: currentTier.color }]} />
              <Text style={[styles.perkText, { color: colors.foreground }]}>{perk}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.allLevelsTitle, { color: colors.foreground }]}>Todos os níveis</Text>
        {TIERS.map((tier) => {
          const isActive = tier.name === currentTier.name;
          const isUnlocked = totalRides >= tier.minRides;
          return (
            <View
              key={tier.name}
              style={[styles.tierRow, {
                backgroundColor: isActive ? tier.color + "18" : colors.card,
                borderColor: isActive ? tier.color + "66" : colors.border,
              }]}
            >
              <View style={[styles.tierRowIcon, { backgroundColor: tier.color + "22", opacity: isUnlocked ? 1 : 0.4 }]}>
                <Feather name="award" size={18} color={tier.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.tierRowTop}>
                  <Text style={[styles.tierRowName, { color: isUnlocked ? tier.color : colors.mutedForeground }]}>{tier.name}</Text>
                  {isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: tier.color }]}>
                      <Text style={styles.activeBadgeText}>ATUAL</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tierRowMin, { color: colors.mutedForeground }]}>
                  {tier.minRides === 0 ? "Nível inicial" : `A partir de ${tier.minRides} corridas`}
                </Text>
              </View>
              {isUnlocked ? (
                <Feather name="check-circle" size={18} color={tier.color} />
              ) : (
                <Feather name="lock" size={16} color={colors.mutedForeground} />
              )}
            </View>
          );
        })}
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
  content: { padding: 16, gap: 16 },
  tierCard: { borderRadius: 20, padding: 20, gap: 16 },
  tierTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  tierIcon: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  tierLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  tierName: { fontSize: 24, fontFamily: "Inter_700Bold" },
  ridesBox: { alignItems: "center" },
  ridesNum: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  ridesLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  progressSection: { gap: 8 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  maxTierText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFD700", textAlign: "center" },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase", padding: 14, paddingBottom: 10 },
  perkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  perkDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  perkText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  allLevelsTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tierRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  tierRowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tierRowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierRowName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  activeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  activeBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  tierRowMin: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
