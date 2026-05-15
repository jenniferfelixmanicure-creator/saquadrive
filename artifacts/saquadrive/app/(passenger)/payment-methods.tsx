import { Feather } from "@expo/vector-icons";
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

import { useColors } from "@/hooks/useColors";

const PAYMENT_OPTIONS = [
  {
    icon: "dollar-sign" as const,
    title: "Dinheiro",
    desc: "Pague em dinheiro diretamente ao motorista ao final da corrida.",
    color: "#22c55e",
    active: true,
  },
  {
    icon: "smartphone" as const,
    title: "Pix",
    desc: "Transfira via Pix diretamente para o motorista ao final da corrida.",
    color: "#00B4D8",
    active: true,
  },
];

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Formas de pagamento</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            O pagamento é realizado diretamente ao motorista no final da corrida. Combine a forma de pagamento com ele.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FORMAS ACEITAS</Text>

        {PAYMENT_OPTIONS.map((opt) => (
          <View key={opt.title} style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.payIcon, { backgroundColor: opt.color + "22" }]}>
              <Feather name={opt.icon} size={22} color={opt.color} />
            </View>
            <View style={styles.payInfo}>
              <Text style={[styles.payTitle, { color: colors.foreground }]}>{opt.title}</Text>
              <Text style={[styles.payDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: colors.success + "22" }]}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.activeText, { color: colors.success }]}>Disponível</Text>
            </View>
          </View>
        ))}

        <View style={[styles.noteCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.noteTitle, { color: colors.foreground }]}>Como funciona?</Text>
          <View style={styles.noteItem}>
            <Text style={[styles.noteStep, { color: colors.primary }]}>1.</Text>
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Solicite sua corrida normalmente</Text>
          </View>
          <View style={styles.noteItem}>
            <Text style={[styles.noteStep, { color: colors.primary }]}>2.</Text>
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Combine a forma de pagamento com o motorista via chat</Text>
          </View>
          <View style={styles.noteItem}>
            <Text style={[styles.noteStep, { color: colors.primary }]}>3.</Text>
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Pague em dinheiro ou Pix ao final da corrida</Text>
          </View>
        </View>
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
  infoBanner: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  payCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  payIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  payInfo: { flex: 1 },
  payTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  payDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  activeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  noteCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  noteTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  noteItem: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  noteStep: { fontSize: 14, fontFamily: "Inter_700Bold", width: 16 },
  noteText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
});
