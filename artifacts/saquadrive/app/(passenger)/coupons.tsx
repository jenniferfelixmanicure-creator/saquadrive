import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Coupon = {
  code: string;
  description: string | null;
  discountType: "fixed" | "percent";
  discountValue: number;
  expiresAt: string | null;
};

export default function CouponsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiFetch } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [inputCode, setInputCode] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadActiveCoupons();
  }, []);

  async function loadActiveCoupons() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/rides/promo/active");
      if (res.ok) {
        const data = await res.json() as Coupon[];
        setCoupons(data);
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function handleApplyCoupon() {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    setValidating(true);
    try {
      const res = await apiFetch("/api/rides/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { valid?: boolean; message?: string; discountType?: string; discountValue?: number; description?: string; code?: string };
      if (!res.ok || !data.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Cupom inválido", data.message ?? "Este código não existe ou já expirou.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInputCode("");
      Alert.alert("Cupom válido!", `${data.description ?? code} — ${formatDiscount(data.discountType as "fixed" | "percent", data.discountValue ?? 0)}`);
    } catch {
      Alert.alert("Erro", "Não foi possível validar o código. Tente novamente.");
    } finally {
      setValidating(false);
    }
  }

  function formatDiscount(type: "fixed" | "percent", value: number): string {
    if (type === "percent") return `${value}% off`;
    return `R$ ${value.toFixed(2)} off`;
  }

  function formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) return "Sem expiração";
    const d = new Date(expiresAt);
    return `Válido até ${d.toLocaleDateString("pt-BR")}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cupons e promoções</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tem um código?</Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>Digite o código do cupom para verificar o desconto</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.codeInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={inputCode}
              onChangeText={setInputCode}
              placeholder="Ex: ZERORISCO10"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleApplyCoupon}
            />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary, opacity: validating ? 0.7 : 1 }]}
              onPress={handleApplyCoupon}
              activeOpacity={0.85}
              disabled={validating}
            >
              {validating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.applyBtnText}>Verificar</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CUPONS DISPONÍVEIS</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Carregando cupons...</Text>
          </View>
        ) : coupons.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="tag" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum cupom disponível</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Novos cupons aparecem aqui quando o administrador os ativar.
            </Text>
          </View>
        ) : (
          coupons.map((coupon) => (
            <View key={coupon.code} style={[styles.couponCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.couponLeft, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="tag" size={20} color={colors.primary} />
              </View>
              <View style={styles.couponInfo}>
                <View style={styles.couponTopRow}>
                  <Text style={[styles.couponCode, { color: colors.primary }]}>{coupon.code}</Text>
                  <View style={[styles.discountBadge, { backgroundColor: colors.success + "22" }]}>
                    <Text style={[styles.discountText, { color: colors.success }]}>
                      {formatDiscount(coupon.discountType, coupon.discountValue)}
                    </Text>
                  </View>
                </View>
                {coupon.description ? (
                  <Text style={[styles.couponDesc, { color: colors.foreground }]}>{coupon.description}</Text>
                ) : null}
                <Text style={[styles.couponExpiry, { color: colors.mutedForeground }]}>{formatExpiry(coupon.expiresAt)}</Text>
              </View>
            </View>
          ))
        )}

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
    paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 1,
  },
  applyBtn: {
    height: 48, paddingHorizontal: 18, borderRadius: 12,
    alignItems: "center", justifyContent: "center", minWidth: 100,
  },
  applyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  couponCard: { flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
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
  loadingBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyBox: {
    alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 32, gap: 12,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});

