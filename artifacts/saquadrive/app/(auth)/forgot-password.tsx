import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { API_URL } from "@/constants/api";

type Step = "verify" | "newpass";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleVerify() {
    if (!email.trim()) { setError("Digite seu e-mail"); return; }
    if (!phone.trim()) { setError("Digite o telefone cadastrado"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), phone: phone.trim() }),
      });
      const data = await res.json() as { message?: string; verified?: boolean; resetToken?: string };
      if (!data.verified || !data.resetToken) {
        setError(data.message ?? "E-mail ou telefone incorretos");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetToken(data.resetToken);
      setStep("newpass");
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) { setError("Nova senha deve ter no mínimo 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), resetToken, newPassword }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Erro ao redefinir senha"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
          <View style={styles.centerContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "22" }]}>
              <Feather name="check-circle" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground, textAlign: "center" }]}>Senha redefinida!</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, marginTop: 32 }]}
              onPress={() => router.replace("/(auth)/login")}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => step === "newpass" ? setStep("verify") : router.back()}
            style={[styles.backBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {step === "verify" ? "Recuperar senha" : "Nova senha"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {step === "verify"
              ? "Confirme seu e-mail e o telefone cadastrado para continuar"
              : "Escolha uma nova senha para sua conta"}
          </Text>
        </View>

        {step === "verify" ? (
          <View style={styles.form}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>E-MAIL</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>TELEFONE CADASTRADO</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="(11) 91234-5678"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Usamos o telefone que você cadastrou para confirmar sua identidade — sem precisar de SMS ou e-mail.
              </Text>
            </View>

            {error ? <ErrorBox error={error} colors={colors} /> : null}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.85 : 1 }]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Verificar identidade</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
              <Feather name="check-circle" size={14} color={colors.primary} />
              <Text style={[styles.verifiedText, { color: colors.primary }]}>Identidade verificada — defina sua nova senha</Text>
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>NOVA SENHA</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { color: colors.foreground, flex: 1 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>CONFIRMAR NOVA SENHA</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a senha"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            {error ? <ErrorBox error={error} colors={colors} /> : null}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.85 : 1 }]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Redefinir senha</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ErrorBox({ error, colors }: { error: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
      <Feather name="alert-circle" size={14} color={colors.destructive} />
      <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  header: { marginBottom: 40 },
  backBtn: { marginBottom: 28, width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  form: { gap: 16 },
  inputWrapper: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: { fontSize: 16, fontFamily: "Inter_400Regular" },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  verifiedText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  btn: { borderRadius: 14, height: 54, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
