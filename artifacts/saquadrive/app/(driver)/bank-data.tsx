import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const PIX_TYPES = ["CPF", "CNPJ", "Telefone", "E-mail", "Chave aleatória"] as const;
type PixType = typeof PIX_TYPES[number];

export default function DriverBankDataScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [pixType, setPixType] = useState<PixType>("CPF");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!pixKey.trim()) {
      Alert.alert("Atenção", "Informe sua chave PIX.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Dados bancários PIX</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoBanner, { backgroundColor: "#00C4FF18", borderColor: "#00C4FF44" }]}>
          <Feather name="info" size={16} color="#00C4FF" />
          <Text style={[styles.infoText, { color: "#00C4FF" }]}>
            Seus ganhos serão transferidos para esta chave PIX semanalmente.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>TIPO DE CHAVE PIX</Text>
          <View style={styles.typeRow}>
            {PIX_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, {
                  backgroundColor: pixType === t ? "#00C4FF" : colors.muted,
                  borderColor: pixType === t ? "#00C4FF" : colors.border,
                }]}
                onPress={() => { setPixType(t); setPixKey(""); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeBtnText, { color: pixType === t ? "#fff" : colors.foreground }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CHAVE PIX</Text>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {pixType === "CPF" ? "CPF (somente números)" :
               pixType === "CNPJ" ? "CNPJ (somente números)" :
               pixType === "Telefone" ? "Telefone com DDD" :
               pixType === "E-mail" ? "Endereço de e-mail" : "Chave aleatória (UUID)"}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={pixKey}
              onChangeText={setPixKey}
              placeholder={
                pixType === "CPF" ? "000.000.000-00" :
                pixType === "CNPJ" ? "00.000.000/0000-00" :
                pixType === "Telefone" ? "(21) 99999-9999" :
                pixType === "E-mail" ? "seu@email.com" : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              }
              placeholderTextColor={colors.mutedForeground}
              keyboardType={pixType === "CPF" || pixType === "CNPJ" || pixType === "Telefone" ? "numeric" : "default"}
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? colors.success : "#00C4FF" }]}
          onPress={handleSave} disabled={loading} activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={saved ? "check" : "save"} size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{saved ? "Salvo!" : "Salvar chave PIX"}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    height: 52, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
