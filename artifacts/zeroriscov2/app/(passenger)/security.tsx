import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { API_URL } from "@/constants/api";

export default function SecurityScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Senha fraca", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Senhas diferentes", "A nova senha e a confirmação não coincidem.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Senha alterada", "Sua senha foi atualizada com sucesso.", [{ text: "OK", onPress: () => router.back() }]);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert("Erro", (data as { message?: string }).message ?? "Senha atual incorreta. Tente novamente.");
      }
    } catch {
      Alert.alert("Erro de conexão", "Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Segurança</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {/* Info dicas */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="shield" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Dicas de segurança</Text>
            <Text style={[styles.infoDesc, { color: colors.mutedForeground }]}>
              Use uma senha com letras, números e símbolos. Não compartilhe sua senha com ninguém.
            </Text>
          </View>
        </View>

        {/* Formulário de senha */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ALTERAR SENHA</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Senha atual</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, flex: 1 }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Digite sua senha atual"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
                <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nova senha</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, flex: 1 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
                <Feather name={showNew ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {newPassword.length > 0 && newPassword.length < 6 && (
              <Text style={[styles.errorHint, { color: colors.destructive }]}>Mínimo de 6 caracteres</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirmar nova senha</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, flex: 1 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={[styles.errorHint, { color: colors.destructive }]}>As senhas não coincidem</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleChangePassword}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="lock" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Alterar senha</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  infoIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  infoTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  infoDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular",
  },
  eyeBtn: {
    position: "absolute", right: 14, height: 48,
    alignItems: "center", justifyContent: "center",
  },
  errorHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  saveBtn: {
    height: 52, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
