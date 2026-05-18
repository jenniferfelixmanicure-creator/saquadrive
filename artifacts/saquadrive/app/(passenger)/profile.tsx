import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useRide } from "@/contexts/RideContext";
import { useColors } from "@/hooks/useColors";

type RowProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useColors>;
};

function Row({ icon, label, value, onPress, danger, colors }: RowProps) {
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
      <Text
        style={[
          styles.rowLabel,
          { color: danger ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      {value && (
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

export default function PassengerProfileScreen() {
  const { user, logout } = useAuth();
  const { history } = useRide();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

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

  function handleSwitchMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0D1A2E", "#0D0D0D"]}
        style={[styles.headerGrad, { paddingTop: topPad + 16 }]}
      >
        {user?.profilePhotoUrl ? (
          <Image
            source={{ uri: user.profilePhotoUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.primary }]}>
              {history.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Corridas</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <View style={styles.ratingRow}>
              <Feather name="star" size={16} color="#FFD60A" />
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {user?.passengerRating?.toFixed(1) ?? "5.0"}
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Avaliação</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>
              {user?.phone?.split(" ").pop() ?? "—"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Telefone</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="user" label="Editar perfil" onPress={() => router.push("/(passenger)/edit-profile")} colors={colors} />
          <Row icon="phone" label="Telefone" value={user?.phone} colors={colors} />
          <Row icon="mail" label="E-mail" value={user?.email} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="credit-card" label="Métodos de pagamento" onPress={() => router.push("/(passenger)/payment-methods")} colors={colors} />
          <Row icon="gift" label="Cupons e promoções" onPress={() => router.push("/(passenger)/coupons")} colors={colors} />
          <Row icon="star" label="Programa de fidelidade" onPress={() => router.push("/(passenger)/loyalty-program")} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="navigation" label="Modo Motorista" onPress={handleSwitchMode} colors={colors} />
          <Row icon="bell" label="Notificações" onPress={() => router.push("/(passenger)/notifications")} colors={colors} />
          <Row icon="shield" label="Segurança" onPress={() => router.push("/(passenger)/security")} colors={colors} />
          <Row icon="file-text" label="Upload de Documentos" onPress={() => router.push("/(passenger)/upload-documents")} colors={colors} />
          <Row icon="help-circle" label="Ajuda e suporte" onPress={() => router.push("/(passenger)/help-support")} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="log-out" label="Sair" onPress={handleLogout} danger colors={colors} />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Zerorisco v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  email: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 20,
  },
  statItem: { alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 32 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  content: { padding: 16, gap: 12 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
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
  version: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
});
