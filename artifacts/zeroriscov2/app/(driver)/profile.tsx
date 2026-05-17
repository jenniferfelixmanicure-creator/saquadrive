import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
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

type RowProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  badge?: string;
  onPress?: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useColors>;
};

function Row({ icon, label, value, badge, onPress, danger, colors }: RowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.destructive + "22" : colors.muted }]}>
        <Feather name={icon} size={18} color={danger ? colors.destructive : colors.foreground} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.success + "22" }]}>
          <Text style={[styles.badgeText, { color: colors.success }]}>{badge}</Text>
        </View>
      )}
      {value && (
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

export default function DriverProfileScreen() {
  const { user, logout } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "M";

  async function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      await logout();
      router.replace("/(auth)/login");
      return;
    }
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0D1A2E", "#0D0D0D"]}
        style={[styles.topGrad, { height: topPad + 260 }]}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <View style={[styles.profileHeader, { paddingTop: topPad + 16 }]}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="star" size={14} color="#FFD60A" />
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {user?.driverRating?.toFixed(1) ?? "5.0"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Avaliação</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Feather name="navigation" size={14} color={colors.accent} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>112</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Corridas</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Feather name="shield" size={14} color={colors.success} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>98%</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Aprovação</Text>
            </View>
          </View>
        </View>

        {/* Vehicle info */}
        <View style={[styles.vehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.vehicleHeader}>
            <Feather name="truck" size={18} color={colors.accent} />
            <Text style={[styles.vehicleTitle, { color: colors.foreground }]}>Meu veículo</Text>
          </View>
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleRow}>
              <Text style={[styles.vehicleLabel, { color: colors.mutedForeground }]}>Modelo</Text>
              <Text style={[styles.vehicleValue, { color: colors.foreground }]}>
                {user?.vehicleModel ?? "Não cadastrado"}
              </Text>
            </View>
            <View style={styles.vehicleRow}>
              <Text style={[styles.vehicleLabel, { color: colors.mutedForeground }]}>Tipo</Text>
              <Text style={[styles.vehicleValue, { color: colors.foreground }]}>
                {user?.vehicleType === "moto" ? "Moto" : user?.vehicleType === "car" ? "Carro" : "—"}
              </Text>
            </View>
            <View style={styles.vehicleRow}>
              <Text style={[styles.vehicleLabel, { color: colors.mutedForeground }]}>Placa</Text>
              <Text style={[styles.vehicleValue, { color: colors.foreground }]}>
                {user?.vehiclePlate ?? "Não cadastrada"}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="user" label="Editar perfil" onPress={() => router.push("/(driver)/edit-profile")} colors={colors} />
          <Row icon="file-text" label="Documentos" badge={user?.isApproved ? "Aprovado" : "Pendente"} onPress={() => router.push("/(driver)/upload-documents")} colors={colors} />
          <Row icon="credit-card" label="Dados bancários PIX" onPress={() => router.push("/(driver)/bank-data")} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="bar-chart-2" label="Meu desempenho" onPress={() => router.push("/(driver)/earnings")} colors={colors} />
          <Row icon="target" label="Metas do dia" onPress={() => router.push("/(driver)/goals")} colors={colors} />
          <Row icon="award" label="Recompensas" onPress={() => router.push("/(driver)/rewards")} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="map-pin" label="Modo Passageiro" onPress={() => router.replace("/")} colors={colors} />
          <Row icon="bell" label="Notificações" onPress={() => router.push("/(driver)/notifications")} colors={colors} />
          <Row icon="help-circle" label="Suporte" onPress={() => router.push("/(driver)/help-support")} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="log-out" label="Sair" onPress={handleLogout} danger colors={colors} />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>SaquaDrive v1.0.0 · Motorista</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: 16, gap: 12 },
  profileHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 3,
    borderColor: "#00C4FF44",
  },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  email: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    width: "100%",
    justifyContent: "center",
  },
  statItem: { alignItems: "center", gap: 4 },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 32 },
  vehicleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  vehicleHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  vehicleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  vehicleInfo: { gap: 8 },
  vehicleRow: { flexDirection: "row", justifyContent: "space-between" },
  vehicleLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  vehicleValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  version: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
