import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Coupon = {
  code: string;
  desc: string;
  discount: string;
  expiry: string;
  used: boolean;
};

const AVAILABLE_COUPONS: Coupon[] = [
  { code: "PRIMERIACORRIDA", desc: "Desconto na primeira corrida", discount: "R$ 5,00 off", expiry: "31/12/2026", used: false },
  { code: "SAQUADRIVE10", desc: "10% de desconto em qualquer corrida", discount: "10% off", expiry: "30/06/2026", used: false },
];

export default function CouponsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [inputCode, setInputCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState<Coupon[]>([]);

  function handleApplyCoupon() {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;

    const found = AVAILABLE_COUPONS.find((c) => c.code === code);
    if (!found) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Cupom inválido", "Este código não existe ou já expirou.");
      return;
    }
    if (appliedCoupons.find((c) => c.code === code)) {
      Alert.alert("Cupom já adicionado", "Você já adicionou este cupom.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAppliedCoupons((prev) => [...prev, found]);
    setInputCode("");
    Alert.alert("Cupom adicionado!", `${found.desc} — ${found.discount}`);
  }

  const activeCoupons = [...appliedCoupons, ...AVAILABLE_COUPONS].filter(
    (c, idx, arr) => arr.findIndex((x) => x.code === c.code) === idx
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cupons e promoções</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {/* Campo de código */}
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tem um código?</Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>Digite o código do cupom para ativar o desconto</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.codeInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={inputCode}
              onChangeText={setInputCode}
              placeholder="Ex: SAQUADRIVE10"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleApplyCoupon}
            />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={handleApplyCoupon}
              activeOpacity={0.85}
            >
              <Text style={styles.applyBtnText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cupons disponíveis */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CUPONS DISPONÍVEIS</Text>
        {activeCoupons.map((coupon) => (
          <View key={coupon.code} style={[styles.couponCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.couponLeft, { backgroundColor: colors.primary + "22" }]}>
              <Feather name="tag" size={20} color={colors.primary} />
            </View>
            <View style={styles.couponInfo}>
              <View style={styles.couponTopRow}>
                <Text style={[styles.couponCode, { color: colors.primary }]}>{coupon.code}</Text>
                <View style={[styles.discountBadge, { backgroundColor: colors.success + "22" }]}>
                  <Text style={[styles.discountText, { color: colors.success }]}>{coupon.discount}</Text>
                </View>
              </View>
              <Text style={[styles.couponDesc, { color: colors.foreground }]}>{coupon.desc}</Text>
              <Text style={[styles.couponExpiry, { color: colors.mutedForeground }]}>Válido até {coupon.expiry}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Os descontos são aplicados automaticamente na próxima corrida elegível.
          </Text>
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
  inputCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  codeRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  applyBtn: {
    height: 48, paddingHorizontal: 18, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  applyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  couponCard: {
    flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  couponLeft: { width: 56, alignItems: "center", justifyContent: "center" },
  couponInfo: { flex: 1, padding: 14, gap: 4 },
  couponTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  couponCode: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  discountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  discountText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  couponDesc: { fontSize: 14, fontFamily: "Inter_500Medium" },
  couponExpiry: { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
